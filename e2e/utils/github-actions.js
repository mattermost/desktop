// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
        // Determine OS key based on runner
        let osKey;
        if (platform.runner.includes('ubuntu')) {
            osKey = 'LINUX';
        } else if (platform.runner.includes('macos')) {
            osKey = 'MACOS';
        } else {
            osKey = 'WINDOWS';
        }

        const failures = outputs[`NEW_FAILURES_${osKey}`] || 0;
        const status = outputs[`STATUS_${osKey}`] || 'failure';
        let reportLink = mergedReportUrl || outputs[`REPORT_LINK_${osKey}`];
        if (!reportLink) {
            reportLink = workflowUrl;
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

module.exports = {
    updateInitialStatus,
    updateFinalStatus,
};
