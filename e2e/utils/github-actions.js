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
 */
async function updateCmtOsStatusesFromWorkflowJobs({github, context, sha, platforms}) {
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
    summarizeCmtJobsByOs,
    cmtOsCommitStatus,
    playwrightProjectForOs,
    osStatusContext,
    E2E_OS_LIST,
};
