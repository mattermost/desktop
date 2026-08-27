// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

/** Canonical OS identifiers for e2e/<os> commit statuses. */
const E2E_OS_LIST = ['linux', 'macos', 'windows'];

/** Platforms that run dedicated policy-test legs (PR / master only). */
const E2E_POLICY_OS_LIST = ['macos', 'windows'];

/** Per-OS commit status contexts for PR / master / CMT (restored from pre-TSIO merge). */
const E2E_OS_STATUS_CONTEXTS = E2E_OS_LIST.map((os) => `e2e/${os}`);

/** Policy commit status contexts: e2e/macos-policy, e2e/windows-policy. */
const E2E_POLICY_STATUS_CONTEXTS = E2E_POLICY_OS_LIST.map((os) => `e2e/${os}-policy`);

const E2E_WORKFLOW_NAME = 'Electron Playwright Tests';
const ACTIVE_RUN_STATUSES = ['in_progress', 'queued', 'waiting'];
const CANCELLED_STATUS_DESCRIPTION = 'E2E cancelled — tests skipped';

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
 * @param {string} os - macos | windows
 * @returns {string}
 */
function policyStatusContext(os) {
    return `e2e/${os}-policy`;
}

/**
 * Post pending e2e/<os> (and optionally e2e/<os>-policy) statuses for this run.
 *
 * @param {Object} params
 * @param {Object} params.github
 * @param {Object} params.context
 * @param {string} params.sha
 * @param {Array<{platform?: string, os?: string, runner?: string}>} params.platforms
 * @param {boolean} [params.includePolicy] - When true (PR/master), also pending policy checks
 */
async function updateInitialOsStatuses({github, context, sha, platforms, includePolicy = false}) {
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

    if (targets.length === 0 && !includePolicy) {
        console.log('No canonical OS platforms — skipping pending e2e/<os> statuses');
        return;
    }

    const posts = targets.map((os) =>
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
    );

    if (includePolicy) {
        for (const os of E2E_POLICY_OS_LIST) {
            posts.push(
                github.rest.repos.createCommitStatus({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    sha,
                    state: 'pending',
                    context: policyStatusContext(os),
                    description: `Policy tests on ${os} have started...`,
                    target_url: workflowUrl,
                }).catch((error) => {
                    console.log(`Could not set pending ${policyStatusContext(os)} on ${sha}: ${error.message}`);
                }),
            );
        }
    }

    await Promise.all(posts);
}

/**
 * Mark the E2E commit statuses as cancelled/skipped on a SHA.
 * The e2e/<os> contexts are required checks, so only `success` unblocks merge.
 */
async function markE2EStatusesCancelled({github, context, sha, reason = CANCELLED_STATUS_DESCRIPTION, state = 'error'}) {
    const description = String(reason).substring(0, 140);
    const targetUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
    const contexts = [...E2E_OS_STATUS_CONTEXTS, ...E2E_POLICY_STATUS_CONTEXTS];

    await Promise.all(contexts.map((statusContext) =>
        github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha,
            state,
            context: statusContext,
            description,
            target_url: targetUrl,
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
    removeE2ELabel,
    markE2EStatusesCancelled,
    cancelActiveE2ERuns,
    updateInitialOsStatuses,
    osStatusContext,
    policyStatusContext,
    canonicalizeOs,
    E2E_OS_LIST,
    E2E_POLICY_OS_LIST,
    E2E_OS_STATUS_CONTEXTS,
    E2E_POLICY_STATUS_CONTEXTS,

    // Back-compat alias for callers that still import the old singular name.
    E2E_STATUS_CONTEXT: E2E_OS_STATUS_CONTEXTS[0],
    CANCELLED_STATUS_DESCRIPTION,
};
