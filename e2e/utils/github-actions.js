/**
 * GitHub Actions utility functions for E2E workflow status updates
 */

/**
 * Update initial pending status for all platforms
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Array} params.platforms - Array of platform objects from matrix
 */
async function updateInitialStatus({ github, context, platforms }) {
    const workflowUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    for (const platform of platforms) {
        await github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha: context.sha,
            state: 'pending',
            context: `e2e/${platform.platform}`,
            description: `E2E tests for Mattermost desktop app on ${platform.platform} have started...`,
            target_url: workflowUrl
        });
        console.log(`Created initial status for e2e/${platform.platform}`);
    }
}

/**
 * Update final status for all platforms based on test results
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Array} params.platforms - Array of platform objects from matrix
 * @param {Object} params.outputs - Test outputs from e2e-tests job
 */
async function updateFinalStatus({ github, context, platforms, outputs }) {
    for (const platform of platforms) {
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
        let reportLink = outputs[`REPORT_LINK_${osKey}`];
        if (!reportLink) {
            reportLink = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
        }

        await github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha: context.payload.pull_request?.head?.sha || context.sha,
            state: status,
            context: `e2e/${platform.platform}`,
            description: `Completed with ${failures} failures`,
            target_url: reportLink
        });
        console.log(`Updated final status for e2e/${platform.platform}: ${status} with ${failures} failures`);
    }
}

module.exports = {
    updateInitialStatus,
    updateFinalStatus
};
