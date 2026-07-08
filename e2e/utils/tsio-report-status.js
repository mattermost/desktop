// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

const PRODUCTION_URL = 'https://test-io.test.mattermost.com';
const STAGING_URL = 'https://staging-test-io.test.mattermost.com';

const TERMINAL_STATUSES = ['completed', 'incomplete'];
const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
}) {
    const baseUrl = useStaging ? STAGING_URL : PRODUCTION_URL;
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
    const {report_id: reportId} = await beginRes.json();

    // /reports/{id} (no prefix) hits the frontend's repo-or-sha catch-all route,
    // not the report detail page — it needs the g/ (group) prefix.
    const reportUrl = `${baseUrl}/reports/g/${reportId}`;

    let detail;
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        const statusRes = await fetch(`${baseUrl}/api/v1/reports/${reportId}`);
        if (!statusRes.ok) {
            throw new Error(`reports/${reportId} failed: ${statusRes.status} ${await statusRes.text()}`);
        }
        detail = await statusRes.json();
        if (TERMINAL_STATUSES.includes(detail.status)) {
            break;
        }
        if (attempt < POLL_ATTEMPTS - 1) {
            await sleep(POLL_DELAY_MS);
        }
    }

    const stats = detail.test_stats || {};
    const isComplete = detail.status === 'completed';
    const hasFailures = (stats.failed || 0) > 0;
    const overallState = isComplete && !hasFailures ? 'success' : 'failure';

    const summaryLines = [
        `### Test System IO — ${compositeIdentity.name}`,
        '',
        `**Status:** ${detail.status} · **Report:** [${reportId}](${reportUrl})`,
        `**Tests:** ${stats.passed ?? '?'} passed, ${stats.failed ?? '?'} failed, ${stats.flaky ?? 0} flaky, ` +
            `${stats.skipped ?? '?'} skipped (of ${stats.total ?? '?'})`,
        '',
    ];
    await core.summary.addRaw(summaryLines.join('\n')).write();

    const description = `${stats.passed ?? 0}/${stats.total ?? 0} passed, ${stats.failed ?? 0} failed`.slice(0, 140);
    await github.rest.repos.createCommitStatus({
        owner: context.repo.owner,
        repo: context.repo.repo,
        sha: compositeIdentity.commit_sha,
        state: overallState,
        context: commitStatusContext,
        description,
        target_url: reportUrl,
    });

    if (failOnTestFailures && overallState === 'failure') {
        throw new Error(`TSIO report ${reportId} did not pass: status=${detail.status}, failed=${stats.failed || 0}`);
    }

    return {reportUrl, status: detail.status, stats};
}

module.exports = reportTsioStatus;
