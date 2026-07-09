// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

const E2E_STATUS_CONTEXT = 'e2e-test/desktop-playwright';

const E2E_WORKFLOW_NAME = 'Electron Playwright Tests';
const ACTIVE_RUN_STATUSES = ['in_progress', 'queued', 'waiting'];
const CANCELLED_STATUS_DESCRIPTION = 'E2E cancelled — tests skipped';

/**
 * Mark the E2E commit status as cancelled/skipped on a SHA.
 * GitHub commit statuses have no "skipped" state — `error` matches mobile E2E.
 */
async function markE2EStatusesCancelled({github, context, sha, reason = CANCELLED_STATUS_DESCRIPTION}) {
    const description = String(reason).substring(0, 140);
    const targetUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    try {
        await github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha,
            state: 'error',
            context: E2E_STATUS_CONTEXT,
            description,
            target_url: targetUrl,
        });
    } catch (error) {
        console.log(`Could not update ${E2E_STATUS_CONTEXT} on ${sha}: ${error.message}`);
        throw error;
    }
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
    removeE2ELabel,
    markE2EStatusesCancelled,
    cancelActiveE2ERuns,
    E2E_STATUS_CONTEXT,
    CANCELLED_STATUS_DESCRIPTION,
};
