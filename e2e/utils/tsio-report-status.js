// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

const PRODUCTION_URL = 'https://test-io.test.mattermost.com';
const STAGING_URL = 'https://staging-test-io.test.mattermost.com';

const TERMINAL_STATUSES = ['completed', 'incomplete'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function intEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') {
        return fallback;
    }
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : fallback;
}

function positiveInt(value, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Dashboard URL keyed by display identity (repo / branch / short SHA / name).
 * Lists every TSIO run for that commit+name — matches test-system-io-summary
 * and test-system-io-dispatch-begin. Use for commit-status target_url.
 */
function buildDisplayReportUrl(baseUrl, compositeIdentity) {
    const repoTrailing = (compositeIdentity.repository || '').split('/').pop() || compositeIdentity.repository;
    const repo = encodeURIComponent(repoTrailing);
    const branch = encodeURIComponent(compositeIdentity.branch || 'main');
    const shortSha = (compositeIdentity.commit_sha || '').slice(0, 7);
    const name = encodeURIComponent(compositeIdentity.name);
    return `${baseUrl}/reports/${repo}/${branch}/${shortSha}/${name}`;
}

/**
 * Recover a report group's id via the idempotent begin endpoint, poll the
 * public status endpoint until the group leaves in_progress, render a step
 * summary, and flip a commit status.
 * @param {Object} params - Parameters object
 * @param {Object} params.core - @actions/core from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.compositeIdentity - {repository, commit_sha, gh_run_id, name, gh_run_attempt, branch, gh_pr_number}
 * @param {number} params.totalReportsExpected - Number of per-leg reports expected in this group
 * @param {string} params.commitStatusContext - Commit-status context to flip on completion
 * @param {boolean} [params.failOnTestFailures] - When true (default), throw if the group didn't complete cleanly
 * @param {boolean} [params.useStaging] - Target TSIO staging instead of production
 * @param {string} [params.oidcAudience] - OIDC audience claim TSIO expects
 * @param {boolean} [params.upstreamJobsSucceeded] - When false (default true), force the
 *   commit status to failure regardless of TSIO's test stats. TSIO only sees test-case-level
 *   results, so a job-level failure with no failing test attached to it (e.g. a hung worker
 *   teardown, a crashed runner, npm ci failing before any test ran) would otherwise still
 *   read as "100% passed" here even though the actual CI run failed.
 * @param {number} [params.pollAttempts] - How many times to poll report group status (default
 *   12, or TSIO_POLL_ATTEMPTS env). CMT runs with many legs should pass a higher value.
 * @param {number} [params.pollDelayMs] - Delay between polls in ms (default 5000, or
 *   TSIO_POLL_DELAY_MS env).
 * @returns {Promise<{reportUrl: string, status: string, stats: Object}>}
 */
async function reportTsioStatus({
    core,
    context,
    github,
    compositeIdentity,
    totalReportsExpected,
    commitStatusContext,
    failOnTestFailures = true,
    useStaging = false,
    oidcAudience = 'mattermost-test-system-io',
    upstreamJobsSucceeded = true,
    pollAttempts,
    pollDelayMs,
}) {
    const resolvedPollAttempts = positiveInt(
        pollAttempts ?? intEnv('TSIO_POLL_ATTEMPTS', 12),
        12,
    );
    const resolvedPollDelayMs = positiveInt(
        pollDelayMs ?? intEnv('TSIO_POLL_DELAY_MS', 5000),
        5000,
    );

    const baseUrl = useStaging ? STAGING_URL : PRODUCTION_URL;

    // Fallback target for the commit status when no TSIO report ever gets
    // created (begin/poll failed outright) — the reviewer still needs
    // somewhere to click instead of a stuck `pending` row.
    const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    let reportId;
    let displayReportUrl;
    let groupReportUrl;
    let detail;
    try {
        const idToken = await core.getIDToken(oidcAudience);
        core.setSecret(idToken);

        const beginRes = await fetch(`${baseUrl}/api/v1/reports/begin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                repository: compositeIdentity.repository,
                commit: compositeIdentity.commit_sha,
                gh_run_id: compositeIdentity.gh_run_id,
                gh_run_attempt: compositeIdentity.gh_run_attempt,
                framework: 'playwright',
                name: compositeIdentity.name,
                branch: compositeIdentity.branch,
                total_reports_expected: totalReportsExpected,
                ...(compositeIdentity.gh_pr_number ? {gh_pr_number: parseInt(compositeIdentity.gh_pr_number, 10)} : {}),
            }),
        });
        if (!beginRes.ok) {
            throw new Error(`reports/begin failed: ${beginRes.status} ${await beginRes.text()}`);
        }
        ({report_id: reportId} = await beginRes.json());

        displayReportUrl = buildDisplayReportUrl(baseUrl, compositeIdentity);

        // Direct link to this run's merged shard group (job summary only).
        groupReportUrl = `${baseUrl}/reports/g/${reportId}`;

        for (let attempt = 0; attempt < resolvedPollAttempts; attempt++) {
            const statusRes = await fetch(`${baseUrl}/api/v1/reports/${reportId}`);
            if (!statusRes.ok) {
                throw new Error(`reports/${reportId} failed: ${statusRes.status} ${await statusRes.text()}`);
            }
            detail = await statusRes.json();
            if (TERMINAL_STATUSES.includes(detail.status)) {
                break;
            }
            if (attempt < resolvedPollAttempts - 1) {
                await sleep(resolvedPollDelayMs);
            }
        }
    } catch (error) {
        core.error(`TSIO reporting error: ${error.message}`);
        try {
            await github.rest.repos.createCommitStatus({
                owner: context.repo.owner,
                repo: context.repo.repo,
                sha: compositeIdentity.commit_sha,
                state: 'failure',
                context: commitStatusContext,
                description: 'TSIO reporting error — see workflow run for details',
                target_url: displayReportUrl || runUrl,
            });
        } catch (statusError) {
            core.warning(`Failed to create failure commit status: ${statusError.message}`);
        }
        throw error;
    }

    if (!detail) {
        throw new Error('TSIO report status never returned after polling');
    }

    const stats = detail.test_stats || {};
    const isComplete = detail.status === 'completed';
    const isIncomplete = detail.status === 'incomplete';
    const uploadedShards = Array.isArray(detail.reports) ? detail.reports.length : 0;
    const hasFailures = (stats.failed || 0) > 0;

    let overallState = 'failure';
    if (isComplete && !hasFailures && upstreamJobsSucceeded) {
        overallState = 'success';
    }

    let targetUrl = runUrl;
    if (isComplete || isIncomplete) {
        targetUrl = displayReportUrl;
    }

    const summaryLines = [
        `### Test System IO — ${compositeIdentity.name}`,
        '',
        `**Status:** ${detail.status} · **Report:** [${compositeIdentity.name}](${displayReportUrl}) · [this run](${groupReportUrl})`,
        `**Tests:** ${stats.passed ?? '?'} passed, ${stats.failed ?? '?'} failed, ${stats.flaky ?? 0} flaky, ` +
            `${stats.skipped ?? '?'} skipped (of ${stats.total ?? '?'})`,
    ];

    if (uploadedShards > 0) {
        summaryLines.push(`**Shards uploaded:** ${uploadedShards}/${totalReportsExpected}`);
    }

    if (!upstreamJobsSucceeded) {
        summaryLines.push(
            '',
            ':warning: One or more CI jobs failed outside of any tracked test (e.g. a hung worker, a crashed runner) — forcing this status to failure even though the test stats above may show no failures.',
        );
    }

    if (isIncomplete) {
        summaryLines.push(
            '',
            `:warning: Report finalized as \`incomplete\` (${uploadedShards}/${totalReportsExpected} shards) — partial results are in the [TSIO report](${displayReportUrl}); see the [workflow run](${runUrl}) for missing legs.`,
        );
    } else if (!isComplete) {
        summaryLines.push(
            '',
            `:warning: Report never reached a terminal state (stuck at \`${detail.status}\`) after ${resolvedPollAttempts} polls — see the [workflow run](${runUrl}).`,
        );
    }

    summaryLines.push('');
    await core.summary.addRaw(summaryLines.join('\n')).write();

    const descriptionPrefix = upstreamJobsSucceeded ? '' : 'CI job failed (untracked by TSIO), ';
    const description = `${descriptionPrefix}${stats.passed ?? 0}/${stats.total ?? 0} passed, ${stats.failed ?? 0} failed, ${stats.skipped ?? 0} skipped`.slice(0, 140);
    await github.rest.repos.createCommitStatus({
        owner: context.repo.owner,
        repo: context.repo.repo,
        sha: compositeIdentity.commit_sha,
        state: overallState,
        context: commitStatusContext,
        description,
        target_url: targetUrl,
    });

    if (failOnTestFailures && overallState === 'failure') {
        let reason;
        if (!upstreamJobsSucceeded && !hasFailures) {
            reason = 'an upstream CI job failed with no corresponding test failure';
        } else {
            reason = `status=${detail.status}, failed=${stats.failed || 0}`;
        }
        throw new Error(`TSIO report ${reportId} did not pass: ${reason}`);
    }

    return {reportUrl: displayReportUrl, status: detail.status, stats};
}

module.exports = reportTsioStatus;
