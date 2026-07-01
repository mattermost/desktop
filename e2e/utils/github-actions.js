// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

/**
 * Update initial pending status for all platforms
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Array} params.platforms - Array of platform objects from matrix
 */
async function updateInitialStatus({github, context, platforms}) {
    const workflowUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    await Promise.all(platforms.map((platform) =>
        github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha: context.sha,
            state: 'pending',
            context: `e2e/${platform.platform}`,
            description: `E2E tests for Mattermost desktop app on ${platform.platform} have started...`,
            target_url: workflowUrl,
        }),
    ));
}

/**
 * Update final status for all platforms based on test results
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Array} params.platforms - Array of platform objects from matrix
 * @param {Object} params.outputs - Test outputs from e2e-tests job
 */
/**
 * Build the short description shown in the PR status check.
 * Only counts tests that actually ran on this platform (passed + failed).
 * Skipped tests are omitted — they are cross-platform guards, not real
 * failures, and inflate the denominator making results look worse.
 *
 *   - all pass:   "All 161 ran, 161 passed"
 *   - any failure: "161 ran, 157 passed, 4 failed"
 */
function formatStatusDescription({passed, failed, collectionFailed}) {
    if (collectionFailed || (passed === 0 && failed > 0 && passed + failed === failed)) {
        return 'No tests ran (collection failed)';
    }

    const ran = passed + failed;
    if (ran === 0) {
        return failed > 0 ? `0 ran, ${failed} failed` : 'No tests ran';
    }
    if (failed === 0) {
        return `All ${ran} ran, ${passed} passed`;
    }
    return `${ran} ran, ${passed} passed, ${failed} failed`;
}

async function updateFinalStatus({github, context, platforms, outputs}) {
    const workflowUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    await Promise.all(platforms.map((platform) => {
        // Determine OS key based on runner. Each platform's REPORT_LINK_* is its
        // own single-OS Playwright HTML report (uploaded per-OS in the template).
        let osKey;
        if (platform.runner.includes('ubuntu')) {
            osKey = 'LINUX';
        } else if (platform.runner.includes('macos')) {
            osKey = 'MACOS';
        } else {
            osKey = 'WINDOWS';
        }

        const failed = Number(outputs[`NEW_FAILURES_${osKey}`] || 0);
        const passed = Number(outputs[`PASSED_${osKey}`] || 0);
        const skipped = Number(outputs[`SKIPPED_${osKey}`] || 0);
        const total = Number(outputs[`TOTAL_${osKey}`] || 0);
        const status = outputs[`STATUS_${osKey}`] || 'failure';
        const reportLink = outputs[`REPORT_LINK_${osKey}`] || workflowUrl;

        return github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha: context.payload.pull_request?.head?.sha || context.sha,
            state: status,
            context: `e2e/${platform.platform}`,
            description: formatStatusDescription({passed, failed, skipped, total}),
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
    formatStatusDescription,
};
