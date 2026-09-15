// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

/** Canonical OS identifiers for e2e/<os> commit statuses. */
const E2E_OS_LIST = ['linux', 'macos', 'windows'];

/**
 * @param {string} [value] - platform / os field from matrix
 * @param {string} [runner] - GitHub runner label
 * @returns {'linux'|'macos'|'windows'|null}
 */
function canonicalizeOs(value, runner) {
    const raw = String(value || '').toLowerCase();
    if (E2E_OS_LIST.includes(raw)) {
        return raw;
    }
    const r = String(runner || '').toLowerCase();
    if (r.startsWith('ubuntu') || r.startsWith('linux')) {
        return 'linux';
    }
    if (r.startsWith('macos') || r.startsWith('darwin')) {
        return 'macos';
    }
    if (r.startsWith('windows')) {
        return 'windows';
    }
    return null;
}

/**
 * @param {string} os
 * @returns {string}
 */
function osStatusContext(os) {
    return `e2e/${os}`;
}

/**
 * CMT reusable-workflow jobs are named `{os}-{serverVersion}` (e.g. linux-11.9.0).
 *
 * @param {string} [jobName]
 * @returns {'linux'|'macos'|'windows'|null}
 */
function osFromCmtJobName(jobName) {
    return canonicalizeOs(String(jobName || '').split('-')[0]);
}

const PLATFORM_LABEL = {
    linux: '🐧 Linux',
    macos: '🍎 macOS',
    windows: '🪟 Windows',
};

const FETCH_TIMEOUT_MS = 15_000;

/**
 * CMT jobs are named `{os}-{serverVersion}` or `{os}-{serverVersion} / e2e-on-{runner}`.
 *
 * @param {string} [jobName]
 * @returns {{os: 'linux'|'macos'|'windows', serverVersion: string}|null}
 */
function parseCmtMatrixJobName(jobName) {
    const head = String(jobName || '').split('/')[0].trim();
    const os = osFromCmtJobName(head);
    if (!os) {
        return null;
    }
    const prefix = `${os}-`;
    if (!head.toLowerCase().startsWith(prefix)) {
        return null;
    }
    const serverVersion = head.slice(prefix.length).trim();
    if (!serverVersion) {
        return null;
    }
    return {os, serverVersion};
}

/**
 * @param {Array<{name?: string, conclusion?: string}>} jobs
 * @returns {Array<{os: string, serverVersion: string, passed: boolean, conclusion: string}>}
 */
function listCmtMatrixJobResults(jobs) {
    const OS_ORDER = {linux: 0, macos: 1, windows: 2};
    const results = [];
    for (const job of jobs || []) {
        const parsed = parseCmtMatrixJobName(job.name);
        if (!parsed) {
            continue;
        }
        const conclusion = job.conclusion || 'unknown';
        results.push({
            os: parsed.os,
            serverVersion: parsed.serverVersion,
            passed: conclusion === 'success',
            conclusion,
        });
    }
    results.sort((a, b) => {
        const osDiff = (OS_ORDER[a.os] ?? 9) - (OS_ORDER[b.os] ?? 9);
        if (osDiff !== 0) {
            return osDiff;
        }
        return a.serverVersion.localeCompare(b.serverVersion, undefined, {numeric: true});
    });
    return results;
}

/**
 * Job-level CMT rollup for release-6.2 (no TSIO reporter on this branch).
 *
 * @param {Object} params
 * @param {string} [params.desktopVersion]
 * @param {string} [params.sha]
 * @param {string} [params.runUrl]
 * @param {Array<{name?: string, conclusion?: string}>} params.jobs
 * @returns {string}
 */
function formatCmtJobsChannelMessage({desktopVersion, sha, runUrl, jobs}) {
    const legs = listCmtMatrixJobResults(jobs);
    const failed = legs.filter((leg) => !leg.passed);
    const overallFailed = failed.length > 0 || legs.length === 0;
    const shortSha = (sha || '').slice(0, 7);
    const lines = [
        `## ${overallFailed ? '❌' : '✅'} Desktop CMT`,
        '',
    ];
    const meta = [];
    if (desktopVersion) {
        meta.push(`**Branch:** \`${String(desktopVersion).replace(/^refs\/(heads|tags)\//, '')}\``);
    }
    if (shortSha) {
        meta.push(`**Commit:** \`${shortSha}\``);
    }
    if (meta.length > 0) {
        lines.push(meta.join(' · '), '');
    }
    if (failed.length > 0) {
        lines.push(`🔴 **${failed.length} failing job${failed.length === 1 ? '' : 's'}**`, '');
    }
    lines.push(
        '| Platform | Server | Result |',
        '|----------|--------|--------|',
    );
    if (legs.length === 0) {
        lines.push('| — | — | ⚠️ no matrix jobs |', '');
    } else {
        for (const leg of legs) {
            const platform = PLATFORM_LABEL[leg.os] || leg.os;
            const result = leg.passed ? '✅' : `❌ ${leg.conclusion}`;
            lines.push(`| ${platform} | \`${leg.serverVersion}\` | ${result} |`);
        }
        lines.push('');
    }
    lines.push('_release-6.2 CMT reports GitHub job conclusions (this branch has no TSIO rollup)._', '');
    if (runUrl) {
        lines.push(`➡️ **Workflow:** ${runUrl}`);
    }
    return lines.join('\n').trimEnd() + '\n';
}

/**
 * @param {Array<{name?: string, conclusion?: string}>} jobs
 * @param {string[]} expectedOs
 * @returns {Record<string, {failed: boolean, seen: boolean}>}
 */
function summarizeCmtJobsByOs(jobs, expectedOs) {
    const byOs = Object.fromEntries((expectedOs || []).map((os) => [os, {failed: false, seen: false}]));
    for (const job of jobs || []) {
        const os = osFromCmtJobName(job.name);
        if (!os || !byOs[os]) {
            continue;
        }
        byOs[os].seen = true;
        if (['failure', 'cancelled', 'timed_out'].includes(job.conclusion)) {
            byOs[os].failed = true;
        }
    }
    return byOs;
}

/**
 * Commit-status payload for one CMT OS bucket.
 *
 * @param {{failed: boolean, seen: boolean}} row
 * @param {string} os
 * @returns {{state: 'success'|'failure', description: string}}
 */
function cmtOsCommitStatus(row, os) {
    if (row.seen === false) {
        return {state: 'failure', description: `E2E incomplete — no ${os} CMT jobs`};
    }
    if (row.failed) {
        return {state: 'failure', description: `E2E failed on ${os}`};
    }
    return {state: 'success', description: `E2E passed on ${os}`};
}

const PLAYWRIGHT_PROJECT_BY_OS = {
    linux: 'linux',
    macos: 'darwin',
    windows: 'win32',
};

/**
 * @param {'linux'|'macos'|'windows'|null} os
 * @returns {string}
 */
function playwrightProjectForOs(os) {
    return PLAYWRIGHT_PROJECT_BY_OS[os] || 'linux';
}

/**
 * Post pending e2e/<os> statuses for this run.
 *
 * @param {Object} params
 * @param {Object} params.github
 * @param {Object} params.context
 * @param {string} params.sha
 * @param {Array<{platform?: string, os?: string, runner?: string}>} params.platforms
 */
async function updateInitialOsStatuses({github, context, sha, platforms}) {
    const workflowUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
    const seen = new Set();
    const targets = [];

    for (const platform of platforms || []) {
        const os = canonicalizeOs(platform.platform || platform.os, platform.runner);
        if (!os || seen.has(os)) {
            continue;
        }
        seen.add(os);
        targets.push(os);
    }

    if (targets.length === 0) {
        console.log('No canonical OS platforms — skipping pending e2e/<os> statuses');
        return;
    }

    await Promise.all(targets.map((os) =>
        github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha,
            state: 'pending',
            context: osStatusContext(os),
            description: `E2E tests on ${os} have started...`,
            target_url: workflowUrl,
        }).catch((error) => {
            console.log(`Could not set pending ${osStatusContext(os)} on ${sha}: ${error.message}`);
        }),
    ));
}

/**
 * Flip e2e/<os> from CMT matrix job conclusions (release-6.2 has no TSIO reporter).
 *
 * @param {Object} params
 * @param {Object} params.github
 * @param {Object} params.context
 * @param {string} params.sha
 * @param {Array<{platform?: string, os?: string, runner?: string}>} params.platforms
 * @param {Object} [params.core] - actions/github-script core (optional; falls back to console)
 * @param {string} [params.webhookUrl] - MM_E2E_RELEASE_WEBHOOK_URL
 * @param {string} [params.desktopVersion] - tag / ref under test
 */
async function updateCmtOsStatusesFromWorkflowJobs({github, context, sha, platforms, core, webhookUrl, desktopVersion}) {
    const workflowUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
    const expectedOs = [...new Set(
        (platforms || []).map((p) => canonicalizeOs(p.platform || p.os, p.runner)).filter(Boolean),
    )];
    if (expectedOs.length === 0) {
        console.log('No canonical OS platforms — skipping final e2e/<os> statuses');
        return;
    }

    const jobs = [];
    for (let page = 1; page <= 10; page++) {
        const {data} = await github.rest.actions.listJobsForWorkflowRun({
            owner: context.repo.owner,
            repo: context.repo.repo,
            run_id: context.runId,
            per_page: 100,
            page,
        });
        jobs.push(...(data.jobs || []));
        if (!data.jobs || data.jobs.length < 100) {
            break;
        }
    }

    const byOs = summarizeCmtJobsByOs(jobs, expectedOs);
    await Promise.all(expectedOs.map((os) => {
        const {state, description} = cmtOsCommitStatus(byOs[os], os);
        return github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha,
            state,
            context: osStatusContext(os),
            description,
            target_url: workflowUrl,
        }).catch((error) => {
            console.log(`Could not set ${osStatusContext(os)} on ${sha}: ${error.message}`);
        });
    }));

    await notifyCmtChannelFromJobs({
        core,
        webhookUrl,
        desktopVersion,
        sha,
        jobs,
        runUrl: workflowUrl,
    });
}

/**
 * Best-effort incoming-webhook post. Missing URL or a failed POST must not
 * undo commit statuses already written above.
 *
 * @param {Object} params
 * @param {Object} [params.core]
 * @param {string} [params.webhookUrl]
 * @param {string} [params.desktopVersion]
 * @param {string} [params.sha]
 * @param {Array<{name?: string, conclusion?: string}>} params.jobs
 * @param {string} [params.runUrl]
 */
async function notifyCmtChannelFromJobs({core, webhookUrl, desktopVersion, sha, jobs, runUrl}) {
    const log = core || {info: console.log, warning: console.log};
    if (!webhookUrl) {
        log.info('Mattermost webhook URL not set — skipping CMT channel notify');
        return;
    }
    try {
        const text = formatCmtJobsChannelMessage({desktopVersion, sha, runUrl, jobs});
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    username: 'Desktop E2E',
                    icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon.png',
                    text,
                }),
                signal: controller.signal,
            });
            if (!res.ok) {
                throw new Error(`Mattermost webhook failed: ${res.status} ${await res.text()}`);
            }
            await res.text();
        } finally {
            clearTimeout(timer);
        }
        log.info('Posted CMT summary to Mattermost channel');
    } catch (error) {
        log.warning(`E2E Mattermost notify failed: ${error.message}`);
    }
}

/**
 * Update initial pending status for all platforms
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Array} params.platforms - Array of platform objects from matrix
 */
async function updateInitialStatus({github, context, platforms}) {
    await updateInitialOsStatuses({
        github,
        context,
        sha: context.sha,
        platforms,
    });
}

/**
 * Update final status for all platforms based on test results
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Array} params.platforms - Array of platform objects from matrix
 * @param {Object} params.outputs - Test outputs from e2e-tests job
 * @param {string} [params.mergedReportUrl] - Shared merged Playwright report URL
 */
async function updateFinalStatus({github, context, platforms, outputs, mergedReportUrl}) {
    const workflowUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    await Promise.all(platforms.map((platform) => {
        const os = canonicalizeOs(platform.platform || platform.os, platform.runner);
        const osKey = os ? os.toUpperCase() : 'WINDOWS';
        const playwrightProject = playwrightProjectForOs(os);

        const failures = outputs[`NEW_FAILURES_${osKey}`] || 0;
        const status = outputs[`STATUS_${osKey}`] || 'failure';
        let reportLink;
        if (mergedReportUrl) {
            reportLink = `${mergedReportUrl}#?q=p:${playwrightProject}`;
        } else {
            reportLink = outputs[`REPORT_LINK_${osKey}`] || workflowUrl;
        }

        return github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha: context.payload.pull_request?.head?.sha || context.sha,
            state: status,
            context: os ? osStatusContext(os) : `e2e/${platform.platform}`,
            description: `${os || platform.platform} E2E completed with ${failures} failures`,
            target_url: reportLink,
        });
    }));
}

/**
 * Remove E2E/Run label when workflow triggered via Matterwick
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 */
async function removeE2ELabel({github, context}) {
    try {
        // Get the current run to check if it was triggered by workflow_dispatch
        const run = await github.rest.actions.getWorkflowRun({
            owner: context.repo.owner,
            repo: context.repo.repo,
            run_id: context.runId,
        });

        // Only remove the label if this was triggered via workflow_dispatch (Matterwick)
        if (run.data.event !== 'workflow_dispatch') {
            console.log('Label removal skipped - workflow run is not triggered by workflow_dispatch (Matterwick)');
            return;
        }

        // Try to find associated PR
        let prNumber = null;

        // First try: check run.data.pull_requests (reliable for pull_request events)
        if (run.data.pull_requests && run.data.pull_requests.length > 0) {
            prNumber = run.data.pull_requests[0].number;
        } else {
            // Second try: query PRs by head branch (more reliable for workflow_dispatch)
            const branchName = run.data.head_branch;
            if (branchName) {
                // Use the actual head repository owner (supports fork PRs)
                const headOwner = run.data.head_repository?.owner?.login || context.repo.owner;
                const prs = await github.rest.pulls.list({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    state: 'open',
                    head: `${headOwner}:${branchName}`,
                });
                if (prs.data && prs.data.length > 0) {
                    // Prefer the PR whose head SHA matches the workflow run's head SHA
                    const matchingPr = prs.data.find(
                        (pr) => pr.head && pr.head.sha === run.data.head_sha,
                    );
                    if (matchingPr) {
                        prNumber = matchingPr.number;
                    } else {
                        prNumber = prs.data[0].number;
                    }
                }
            }
        }

        if (prNumber) {
            await github.rest.issues.removeLabel({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: prNumber,
                name: 'E2E/Run',
            });
        } else {
            console.log('Label removal skipped - could not find associated PR');
        }
    } catch (error) {
        if (error && error.status === 404) {
            console.log(`Label removal skipped - label or resource not found (404). Details: ${error.message}`);
        } else if (error && error.status === 403) {
            console.log(`Label removal failed - insufficient permissions (403). Details: ${error.message}`);
        } else {
            console.log(`Label removal failed - unexpected error: status=${error && error.status}, message=${error && error.message}`);
        }
    }
}

module.exports = {
    updateInitialStatus,
    updateFinalStatus,
    removeE2ELabel,
    updateInitialOsStatuses,
    updateCmtOsStatusesFromWorkflowJobs,
    canonicalizeOs,
    osFromCmtJobName,
    parseCmtMatrixJobName,
    listCmtMatrixJobResults,
    formatCmtJobsChannelMessage,
    notifyCmtChannelFromJobs,
    summarizeCmtJobsByOs,
    cmtOsCommitStatus,
    playwrightProjectForOs,
    osStatusContext,
    E2E_OS_LIST,
};
