// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

const E2E_STATUS_CONTEXTS = [
    'e2e/linux',
    'e2e/macos',
    'e2e/windows',
    'policy-test/macos',
    'policy-test/windows',
];

const E2E_WORKFLOW_NAME = 'Electron Playwright Tests';
const ACTIVE_RUN_STATUSES = ['in_progress', 'queued', 'waiting'];
const CANCELLED_STATUS_DESCRIPTION = 'E2E cancelled — tests skipped';

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
 * Build the short description shown in the PR status check.
 * Only counts tests that actually ran on this platform (passed + failed).
 * Skipped tests are omitted — they are cross-platform guards, not real
 * failures, and inflate the denominator making results look worse.
 *
 *   - all pass:   "All 161 ran, 161 passed"
 *   - any failure: "161 ran, 157 passed, 4 failed"
 */
function formatStatusDescription({passed, failed}) {
    const ran = passed + failed;
    if (ran === 0) {
        return failed > 0 ? `0 ran, ${failed} failed` : 'No tests ran';
    }
    if (failed === 0) {
        return `All ${ran} ran, ${passed} passed`;
    }
    return `${ran} ran, ${passed} passed, ${failed} failed`;
}

async function resolveStatusSha({github, context, prNumber}) {
    if (prNumber) {
        const {data: pr} = await github.rest.pulls.get({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: prNumber,
        });
        return pr.head.sha;
    }

    return context.payload.pull_request?.head?.sha || context.sha;
}

/**
 * Update final status for all platforms based on test results
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Array} params.platforms - Array of platform objects from matrix
 * @param {Object} params.outputs - Test outputs from e2e-tests job
 * @param {string} [params.e2eTestsResult] - needs.e2e-tests.result from the workflow
 * @param {number} [params.prNumber] - PR number for status SHA lookup
 */
async function updateFinalStatus({github, context, platforms, outputs, e2eTestsResult, prNumber}) {
    const workflowUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
    const sha = await resolveStatusSha({github, context, prNumber});
    const workflowCancelled = e2eTestsResult === 'cancelled';

    await Promise.all(platforms.map((platform) => {
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
        const platformStatus = outputs[`STATUS_${osKey}`] || '';
        const reportLink = outputs[`REPORT_LINK_${osKey}`] || workflowUrl;
        const ran = passed + failed;

        let state;
        let description;

        if (platformStatus === 'error' || (workflowCancelled && ran === 0)) {
            state = 'error';
            description = CANCELLED_STATUS_DESCRIPTION;
        } else if (ran === 0 && (platformStatus === 'success' || platformStatus === '')) {
            state = 'error';
            description = workflowCancelled ? CANCELLED_STATUS_DESCRIPTION : 'E2E incomplete — no tests ran';
        } else if (failed > 0 || platformStatus === 'failure') {
            state = 'failure';
            description = formatStatusDescription({passed, failed});
        } else {
            state = 'success';
            description = formatStatusDescription({passed, failed});
        }

        return github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha,
            state,
            context: `e2e/${platform.platform}`,
            description,
            target_url: reportLink,
        });
    }));
}

/**
 * Mark standard E2E commit statuses as cancelled/skipped on a SHA.
 * GitHub commit statuses have no "skipped" state — `error` matches mobile E2E.
 */
async function markE2EStatusesCancelled({github, context, sha, reason = CANCELLED_STATUS_DESCRIPTION}) {
    const description = String(reason).substring(0, 140);

    await Promise.all(E2E_STATUS_CONTEXTS.map((statusContext) =>
        github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha,
            state: 'error',
            context: statusContext,
            description,
        }).catch((error) => {
            console.log(`Could not update ${statusContext} on ${sha}: ${error.message}`);
        }),
    ));
}

/**
 * Return true when a workflow run belongs to the given PR.
 * Matterwick dispatches with version_name set to the PR head branch, so
 * head_branch on the run matches pull_request.head.ref.
 */
function runBelongsToPr(run, headBranch) {
    return Boolean(headBranch && run.head_branch === headBranch);
}

async function resolvePrHeadBranch({github, context, prNumber, headBranch}) {
    if (headBranch) {
        return headBranch;
    }

    if (!prNumber) {
        return null;
    }

    const {data: pr} = await github.rest.pulls.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
    });
    return pr.head.ref;
}

/**
 * Cancel active Electron Playwright Tests runs for a single PR.
 * Only runs whose head_branch matches the PR branch are cancelled so concurrent
 * E2E runs on other PRs are not interrupted.
 */
async function cancelActiveE2ERuns({github, context, prNumber, headBranch}) {
    const {owner, repo} = context.repo;
    const branch = await resolvePrHeadBranch({github, context, prNumber, headBranch});

    if (!branch) {
        console.log('cancelActiveE2ERuns: no PR branch resolved — skipping cancellation');
        return 0;
    }

    const {data: {workflows}} = await github.rest.actions.listRepoWorkflows({owner, repo});
    const e2eWorkflow = workflows.find((workflow) => workflow.name === E2E_WORKFLOW_NAME);

    if (!e2eWorkflow) {
        console.log(`${E2E_WORKFLOW_NAME} workflow not found — skipping cancellation`);
        return 0;
    }

    let cancelled = 0;

    for (const status of ACTIVE_RUN_STATUSES) {
        const {data: {workflow_runs: workflowRuns}} = await github.rest.actions.listWorkflowRuns({
            owner,
            repo,
            workflow_id: e2eWorkflow.id,
            branch,
            status,
            per_page: 20,
        });

        for (const run of workflowRuns) {
            if (!runBelongsToPr(run, branch)) {
                console.log(`Skipping E2E run ${run.id} (branch ${run.head_branch ?? 'unknown'} != ${branch})`);
                continue;
            }

            try {
                await github.rest.actions.cancelWorkflowRun({owner, repo, run_id: run.id});
                console.log(`Cancelled E2E run ${run.id} for branch ${branch} (status: ${status})`);
                cancelled += 1;
            } catch (error) {
                console.log(`Could not cancel run ${run.id}: ${error.message}`);
            }
        }
    }

    return cancelled;
}

/**
 * Remove E2E/Run label when workflow triggered via Matterwick
 * @param {Object} params - Parameters object
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 */
async function removeE2ELabel({github, context}) {
    try {
        const run = await github.rest.actions.getWorkflowRun({
            owner: context.repo.owner,
            repo: context.repo.repo,
            run_id: context.runId,
        });

        if (run.data.event !== 'workflow_dispatch') {
            console.log('Label removal skipped - workflow run is not triggered by workflow_dispatch (Matterwick)');
            return;
        }

        let prNumber = null;

        if (run.data.pull_requests && run.data.pull_requests.length > 0) {
            prNumber = run.data.pull_requests[0].number;
        } else {
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
                    const matchingPr = prs.data.find(
                        (pr) => pr.head && pr.head.sha === run.data.head_sha,
                    );
                    prNumber = (matchingPr || prs.data[0]).number;
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
    markE2EStatusesCancelled,
    cancelActiveE2ERuns,
    E2E_STATUS_CONTEXTS,
    CANCELLED_STATUS_DESCRIPTION,
};
