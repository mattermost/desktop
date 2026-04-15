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
 * Resolve the PR number for a workflow run.
 *
 * Resolution order:
 *   1. prNumberInput — explicit value passed by the workflow dispatcher (e.g. Matterwick).
 *   2. run.pull_requests — populated for pull_request-triggered runs.
 *   3. Branch/SHA lookup — queries open PRs whose head matches the run's head branch and SHA.
 *      This is the reliable path for workflow_dispatch runs where pull_requests is empty.
 *
 * @param {Object} params
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context (context.runId must be set)
 * @param {string|number} [params.prNumberInput] - Explicit PR number from a workflow input
 * @returns {Promise<number|null>} Resolved PR number, or null if not found
 */
async function findPrNumber({github, context, prNumberInput}) {
    const trimmed = String(prNumberInput ?? '').trim();
    if ((/^\d+$/).test(trimmed)) {
        const parsed = Number(trimmed);
        if (Number.isInteger(parsed) && parsed > 0) {
            return parsed;
        }
    }

    try {
        const run = await github.rest.actions.getWorkflowRun({
            owner: context.repo.owner,
            repo: context.repo.repo,
            run_id: context.runId,
        });

        if (run.data.pull_requests && run.data.pull_requests.length > 0) {
            return run.data.pull_requests[0].number;
        }

        const branchName = run.data.head_branch;
        if (branchName) {
            const headOwner = run.data.head_repository?.owner?.login || context.repo.owner;
            const prs = await github.rest.pulls.list({
                owner: context.repo.owner,
                repo: context.repo.repo,
                state: 'open',
                head: `${headOwner}:${branchName}`,
            });
            if (prs.data && prs.data.length > 0) {
                const matching = prs.data.find((pr) => pr.head && pr.head.sha === run.data.head_sha);
                return matching ? matching.number : null;
            }
        }
    } catch (error) {
        console.log(`Could not resolve PR number: ${error.message}`);
    }

    return null;
}

/**
 * Post (or update) a PR comment listing the provisioned Mattermost server URLs so
 * developers can connect to those servers to reproduce and debug failing tests.
 *
 * The comment is idempotent: if a previous comment with the hidden HTML marker already
 * exists on the PR (e.g. from a previous run triggered by a push to the same branch),
 * it is updated in place rather than a new one being created.
 *
 * The admin password is intentionally omitted from the comment. Use the
 * MM_DESKTOP_E2E_USER_CREDENTIALS repository secret or contact the team.
 *
 * @param {Object} params
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Array}  params.platforms - Array of platform objects from the matrix
 *                                    (each must have at least `platform` and `url`)
 * @param {string} [params.adminUsername] - Admin username for the test instances
 * @param {string} [params.serverVersion] - Mattermost server version under test
 * @param {number} params.prNumber - PR number to comment on
 */
async function postServerInfoComment({github, context, platforms, adminUsername, serverVersion, prNumber}) {
    const MARKER = '<!-- e2e-server-info -->';
    const workflowUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    // Sanitize values before inserting into a Markdown table to prevent
    // table-breaking, HTML injection, or newline-based injection.
    const sanitizeMd = (str) => String(str ?? '').
        replace(/[\r\n]/g, ' ').
        replace(/&/g, '&amp;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;').
        replace(/[|`[\]]/g, (ch) => `\\${ch}`);

    const platformRows = platforms.
        map((p) => `| \`${sanitizeMd(p.platform)}\` | ${sanitizeMd(p.url)} |`).
        join('\n');

    const lines = [
        MARKER,
        '### :test_tube: E2E Test Servers Ready',
        '',
        'Matterwick has provisioned the following Mattermost instances for this PR.',
        'Use them to reproduce and debug failing tests against the exact same servers:',
        '',
        '| Platform | Server URL |',
        '|----------|------------|',
        platformRows,
        '',
    ];

    if (adminUsername) {
        lines.push(`**Admin username:** \`${adminUsername}\``);
    }
    if (serverVersion) {
        lines.push(`**Server version:** \`${serverVersion}\``);
    }

    lines.push(
        '',
        '**Run a single spec against one of these servers:**',
        '```sh',
        'MM_TEST_SERVER_URL=<url above> \\',
        '  MM_TEST_USER_NAME=<username above> \\',
        '  MM_TEST_PASSWORD=<MM_DESKTOP_E2E_USER_CREDENTIALS secret> \\',
        '  npx playwright test <spec-file> --reporter=list --workers=1',
        '```',
        '',
        '> Servers are active for the duration of this workflow run. Label cleanup is disabled — servers may be retained afterwards for agent-driven test fixing.',
        '',
        `**Workflow run:** ${workflowUrl}`,
    );

    const body = lines.join('\n');
    const {owner, repo} = context.repo;

    // Search all pages of comments so the marker is never missed on busy PRs.
    // Without full pagination a PR with > 100 comments would fail to find the
    // existing comment and create a duplicate on every subsequent E2E run.
    let existingCommentId = null;
    try {
        let page = 1;
        while (!existingCommentId) {
            const {data: comments} = await github.rest.issues.listComments({
                owner,
                repo,
                issue_number: prNumber,
                per_page: 100,
                page,
            });
            if (comments.length === 0) {
                break;
            }
            const found = comments.find((c) => c.body && c.body.includes(MARKER));
            if (found) {
                existingCommentId = found.id;
            } else if (comments.length < 100) {
                // Reached the last page without finding the marker.
                break;
            }
            page++;
        }
    } catch (err) {
        console.log(`Could not list PR comments: ${err.message}`);
    }

    if (existingCommentId) {
        await github.rest.issues.updateComment({owner, repo, comment_id: existingCommentId, body});
        console.log(`Updated existing E2E server info comment ${existingCommentId} on PR #${prNumber}`);
    } else {
        await github.rest.issues.createComment({owner, repo, issue_number: prNumber, body});
        console.log(`Posted E2E server info comment on PR #${prNumber}`);
    }
}

/**
 * Remove E2E/Run label when workflow triggered via Matterwick
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 */
async function removeE2ELabel() {
    // Commented out for testing purposes — label removal is disabled so
    // Matterwick keeps provisioned servers alive after tests finish, allowing
    // agents to connect and fix failures in the same run.
    //
    // async function removeE2ELabel({github, context}) {
    //     try {
    //         // Get the current run to check if it was triggered by workflow_dispatch
    //         const run = await github.rest.actions.getWorkflowRun({
    //             owner: context.repo.owner,
    //             repo: context.repo.repo,
    //             run_id: context.runId,
    //         });
    //
    //         // Only remove the label if this was triggered via workflow_dispatch (Matterwick)
    //         if (run.data.event !== 'workflow_dispatch') {
    //             console.log('Label removal skipped - workflow run is not triggered by workflow_dispatch (Matterwick)');
    //             return;
    //         }
    //
    //         // Try to find associated PR
    //         let prNumber = null;
    //
    //         // First try: check run.data.pull_requests (reliable for pull_request events)
    //         if (run.data.pull_requests && run.data.pull_requests.length > 0) {
    //             prNumber = run.data.pull_requests[0].number;
    //         } else {
    //             // Second try: query PRs by head branch (more reliable for workflow_dispatch)
    //             const branchName = run.data.head_branch;
    //             if (branchName) {
    //                 // Use the actual head repository owner (supports fork PRs)
    //                 const headOwner = run.data.head_repository?.owner?.login || context.repo.owner;
    //                 const prs = await github.rest.pulls.list({
    //                     owner: context.repo.owner,
    //                     repo: context.repo.repo,
    //                     state: 'open',
    //                     head: `${headOwner}:${branchName}`,
    //                 });
    //                 if (prs.data && prs.data.length > 0) {
    //                     const matchingPr = prs.data.find(
    //                         (pr) => pr.head && pr.head.sha === run.data.head_sha,
    //                     );
    //                     if (matchingPr) {
    //                         prNumber = matchingPr.number;
    //                     } else {
    //                         prNumber = prs.data[0].number;
    //                     }
    //                 }
    //             }
    //         }
    //
    //         if (prNumber) {
    //             await github.rest.issues.removeLabel({
    //                 owner: context.repo.owner,
    //                 repo: context.repo.repo,
    //                 issue_number: prNumber,
    //                 name: 'E2E/Run',
    //             });
    //         } else {
    //             console.log('Label removal skipped - could not find associated PR');
    //         }
    //     } catch (error) {
    //         if (error && error.status === 404) {
    //             console.log(`Label removal skipped - label or resource not found (404). Details: ${error.message}`);
    //         } else if (error && error.status === 403) {
    //             console.log(`Label removal failed - insufficient permissions (403). Details: ${error.message}`);
    //         } else {
    //             console.log(`Label removal failed - unexpected error: status=${error && error.status}, message=${error && error.message}`);
    //         }
    //     }
    // }
    console.log('removeE2ELabel: commented out for testing purposes — label removal is disabled.');
}

module.exports = {
    findPrNumber,
    postServerInfoComment,
    removeE2ELabel,
    updateFinalStatus,
    updateInitialStatus,
};
