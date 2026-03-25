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
 * @param {string} [params.mergedReportUrl] - Shared merged Playwright report URL
 */
async function updateFinalStatus({github, context, platforms, outputs, mergedReportUrl}) {
    const workflowUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    await Promise.all(platforms.map((platform) => {
        // Determine OS key and Playwright project name based on runner
        let osKey;
        let playwrightProject;
        if (platform.runner.includes('ubuntu')) {
            osKey = 'LINUX';
            playwrightProject = 'linux';
        } else if (platform.runner.includes('macos')) {
            osKey = 'MACOS';
            playwrightProject = 'darwin';
        } else {
            osKey = 'WINDOWS';
            playwrightProject = 'win32';
        }

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
            context: `e2e/${platform.platform}`,
            description: `${platform.platform} E2E completed with ${failures} failures`,
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
};
