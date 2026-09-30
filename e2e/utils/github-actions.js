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
const ACTIVE_RUN_STATUSES = ['in_progress', 'queued', 'waiting', 'pending', 'requested'];
const CANCELLED_STATUS_DESCRIPTION = 'E2E cancelled — tests skipped';
const E2E_PR_RUN_TITLE = /^E2E PR #([1-9][0-9]*) @ [0-9a-f]{40}$/;
const DEFAULT_BRANCH = 'master';

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

function runIdentityTitles(run) {
    return [run?.display_title, run?.name].filter((title) => Boolean(title));
}

function runIdentityTitle(run) {
    return runIdentityTitles(run).find((title) => E2E_PR_RUN_TITLE.test(title)) || run?.display_title || run?.name || '';
}

function prNumberFromRunTitle(run) {
    for (const title of runIdentityTitles(run)) {
        const match = title.match(E2E_PR_RUN_TITLE);
        if (match) {
            return Number.parseInt(match[1], 10);
        }
    }
    return null;
}

/**
 * Return true when a workflow run belongs to the given PR.
 * Ownership is the run-name contract. head_branch is only a legacy fallback
 * for same-repo feature branches, never for master/default-branch dispatches.
 */
function runBelongsToPr(run, prNumber, prHeadRef) {
    const titledPrNumber = prNumberFromRunTitle(run);
    if (titledPrNumber !== null) {
        return titledPrNumber === prNumber;
    }
    return Boolean(
        prHeadRef &&
        prHeadRef !== DEFAULT_BRANCH &&
        run?.head_branch === prHeadRef,
    );
}

async function listActiveWorkflowRuns({github, owner, repo, workflowId}) {
    const runs = [];
    const seen = new Set();
    for (const status of ACTIVE_RUN_STATUSES) {
        for (let page = 1; ; page += 1) {
            const {data} = await github.rest.actions.listWorkflowRuns({
                owner,
                repo,
                workflow_id: workflowId,
                status,
                event: 'workflow_dispatch',
                per_page: 100,
                page,
            });
            const pageRuns = data.workflow_runs || [];
            for (const run of pageRuns) {
                if (!seen.has(run.id)) {
                    seen.add(run.id);
                    runs.push(run);
                }
            }
            if (pageRuns.length < 100) {
                break;
            }
        }
    }
    return runs;
}

/**
 * Cancel active Electron Playwright Tests runs for a single PR.
 * Lists by status and paginates; does not filter the API by PR branch.
 */
async function cancelActiveE2ERuns({github, context, prNumber, headBranch}) {
    const {owner, repo} = context.repo;
    if (!prNumber) {
        console.log('cancelActiveE2ERuns: no PR number — skipping cancellation');
        return 0;
    }

    const {data: {workflows}} = await github.rest.actions.listRepoWorkflows({owner, repo});
    const e2eWorkflow = workflows.find((workflow) => workflow.name === E2E_WORKFLOW_NAME);

    if (!e2eWorkflow) {
        console.log(`${E2E_WORKFLOW_NAME} workflow not found — skipping cancellation`);
        return 0;
    }

    let cancelled = 0;
    const runs = await listActiveWorkflowRuns({
        github,
        owner,
        repo,
        workflowId: e2eWorkflow.id,
    });

    for (const run of runs) {
        if (!runBelongsToPr(run, prNumber, headBranch)) {
            console.log(`Skipping E2E run ${run.id} (${runIdentityTitle(run) || run.head_branch || 'unidentified'})`);
            continue;
        }

        try {
            await github.rest.actions.cancelWorkflowRun({owner, repo, run_id: run.id});
            console.log(`Cancelled E2E run ${run.id} for PR #${prNumber}`);
            cancelled += 1;
        } catch (error) {
            console.log(`Could not cancel run ${run.id}: ${error.message}`);
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

        const prNumber = prNumberFromRunTitle(run.data);
        if (!prNumber) {
            console.log('Label removal skipped - run title has no PR identity');
            return;
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
    runBelongsToPr,
    prNumberFromRunTitle,
    runIdentityTitle,
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
