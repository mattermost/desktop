// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

const E2E_RUN_LABEL = 'E2E/Run';
const E2E_OVERRIDE_LABEL = 'E2E/Override';
const E2E_WORKFLOW_NAME = 'Electron Playwright Tests';
const ACTIVE_RUN_STATUSES = ['in_progress', 'queued', 'waiting'];
const SUPERSEDED_DESCRIPTION = 'E2E pending — superseded by newer run';

const E2E_STATUS_CONTEXTS = [
    'e2e/linux',
    'e2e/macos',
    'e2e/windows',
    'policy-test/macos',
    'policy-test/windows',
];

const RUNNER_OS_KEY = {
    ubuntu: 'LINUX',
    macos: 'MACOS',
    windows: 'WINDOWS',
};

function repoCoords(context) {
    return {owner: context.repo.owner, repo: context.repo.repo};
}

async function postStatuses(github, {owner, repo, sha, state, description, contexts, targetUrl}) {
    const text = String(description).substring(0, 140);
    await Promise.all(contexts.map((statusContext) =>
        github.rest.repos.createCommitStatus({
            owner,
            repo,
            sha,
            state,
            context: statusContext,
            description: text,
            ...(targetUrl ? {target_url: targetUrl} : {}),
        }).catch((error) => {
            console.log(`Could not update ${statusContext} on ${sha}: ${error.message}`);
        }),
    ));
}

async function resolveWorkflowHeadSha({github, context}) {
    try {
        const {data: run} = await github.rest.actions.getWorkflowRun({
            ...repoCoords(context),
            run_id: context.runId,
        });
        if (run.head_sha) {
            return run.head_sha;
        }
    } catch (error) {
        console.log(`Could not resolve workflow head SHA: ${error.message}`);
    }

    return context.payload.pull_request?.head?.sha || context.sha;
}

async function resolvePrNumberFromRun({github, owner, repo, run}) {
    if (run.pull_requests?.length) {
        return run.pull_requests[0].number;
    }

    const branchName = run.head_branch;
    if (!branchName) {
        return null;
    }

    const headOwner = run.head_repository?.owner?.login || owner;
    const {data: prs} = await github.rest.pulls.list({
        owner,
        repo,
        state: 'open',
        head: `${headOwner}:${branchName}`,
    });

    if (!prs.length) {
        return null;
    }

    const matchingPr = prs.find((pr) => pr.head?.sha === run.head_sha);
    return (matchingPr || prs[0]).number;
}

async function removeE2ERunLabelSafe({github, owner, repo, prNumber}) {
    try {
        await github.rest.issues.removeLabel({
            owner,
            repo,
            issue_number: prNumber,
            name: E2E_RUN_LABEL,
        });
    } catch (error) {
        if (error.status !== 404) {
            throw error;
        }
    }
}

function osKeyForRunner(runner = '') {
    const normalized = runner.toLowerCase();
    if (normalized.includes('ubuntu')) {
        return RUNNER_OS_KEY.ubuntu;
    }
    if (normalized.includes('macos')) {
        return RUNNER_OS_KEY.macos;
    }
    return RUNNER_OS_KEY.windows;
}

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

async function updateInitialStatus({github, context, platforms}) {
    const {owner, repo} = repoCoords(context);
    const sha = await resolveWorkflowHeadSha({github, context});
    const workflowUrl = `https://github.com/${owner}/${repo}/actions/runs/${context.runId}`;

    await Promise.all(platforms.map((platform) =>
        github.rest.repos.createCommitStatus({
            owner,
            repo,
            sha,
            state: 'pending',
            context: `e2e/${platform.platform}`,
            description: `E2E tests for Mattermost desktop app on ${platform.platform} have started...`,
            target_url: workflowUrl,
        }),
    ));
}

async function updateFinalStatus({github, context, platforms, outputs, e2eTestsResult, prNumber}) {
    const {owner, repo} = repoCoords(context);
    const sha = await resolveWorkflowHeadSha({github, context});
    const workflowUrl = `https://github.com/${owner}/${repo}/actions/runs/${context.runId}`;
    const workflowCancelled = e2eTestsResult === 'cancelled';

    if (workflowCancelled && prNumber) {
        const {data: pr} = await github.rest.pulls.get({owner, repo, pull_number: prNumber});
        if (pr.head.sha !== sha) {
            console.log(
                `Skipping cancelled run status update: run ${sha.slice(0, 7)} superseded by PR head ${pr.head.sha.slice(0, 7)}`,
            );
            return;
        }
    }

    await Promise.all(platforms.map((platform) => {
        const osKey = osKeyForRunner(platform.runner);
        const failed = Number(outputs[`NEW_FAILURES_${osKey}`] || 0);
        const passed = Number(outputs[`PASSED_${osKey}`] || 0);
        const platformStatus = outputs[`STATUS_${osKey}`] || '';
        const reportLink = outputs[`REPORT_LINK_${osKey}`] || workflowUrl;
        const ran = passed + failed;

        let state;
        let description;

        if (workflowCancelled) {
            state = 'pending';
            description = SUPERSEDED_DESCRIPTION;
        } else if (platformStatus === 'error') {
            state = 'error';
            description = 'E2E incomplete — platform error';
        } else if (ran === 0 && (platformStatus === 'success' || platformStatus === '')) {
            state = 'error';
            description = 'E2E incomplete — no tests ran';
        } else if (failed > 0 || platformStatus === 'failure') {
            state = 'failure';
            description = formatStatusDescription({passed, failed});
        } else {
            state = 'success';
            description = formatStatusDescription({passed, failed});
        }

        return github.rest.repos.createCommitStatus({
            owner,
            repo,
            sha,
            state,
            context: `e2e/${platform.platform}`,
            description,
            target_url: reportLink,
        });
    }));
}

async function setE2EStatusesPending({github, context, sha, reason = SUPERSEDED_DESCRIPTION}) {
    await postStatuses(github, {
        ...repoCoords(context),
        sha,
        state: 'pending',
        description: reason,
        contexts: E2E_STATUS_CONTEXTS,
    });
}

async function cancelActiveE2ERuns({github, context, headRef}) {
    const {owner, repo} = repoCoords(context);

    if (!headRef) {
        console.log('cancelActiveE2ERuns: headRef required — skipping');
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
            branch: headRef,
            status,
            per_page: 20,
        });

        for (const run of workflowRuns) {
            try {
                await github.rest.actions.cancelWorkflowRun({owner, repo, run_id: run.id});
                console.log(`Cancelled E2E run ${run.id} for branch ${headRef} (${status})`);
                cancelled += 1;
            } catch (error) {
                console.log(`Could not cancel run ${run.id}: ${error.message}`);
            }
        }
    }

    return cancelled;
}

/**
 * PR-side E2E orchestration used by e2e-pr-trigger and cancel flows.
 *   refresh  — new push: cancel stale runs, mark head pending, re-add E2E/Run
 *   override — E2E/Override applied or active: cancel runs, mark skipped, strip E2E/Run
 *   stop     — manual E2E/Run removal: cancel runs, mark head pending
 */
async function handleE2EPrSync({
    github,
    context,
    prNumber,
    headSha,
    headRef,
    mode,
    statusReason,
}) {
    const {owner, repo} = repoCoords(context);
    let effectiveMode = mode;
    let reason = statusReason || SUPERSEDED_DESCRIPTION;

    if (mode === 'refresh') {
        const {data: labels} = await github.rest.issues.listLabelsOnIssue({
            owner,
            repo,
            issue_number: prNumber,
        });
        if (labels.some((label) => label.name === E2E_OVERRIDE_LABEL)) {
            console.log(`PR #${prNumber} has ${E2E_OVERRIDE_LABEL} — skipping E2E/Run refresh`);
            effectiveMode = 'override';
            reason = 'E2E pending — skipped (E2E/Override label active)';
        }
    }

    if (effectiveMode === 'override') {
        await removeE2ERunLabelSafe({github, owner, repo, prNumber});
    }

    await cancelActiveE2ERuns({github, context, headRef});
    await setE2EStatusesPending({github, context, sha: headSha, reason});

    if (effectiveMode === 'refresh') {
        await removeE2ERunLabelSafe({github, owner, repo, prNumber});
        await github.rest.issues.addLabels({
            owner,
            repo,
            issue_number: prNumber,
            labels: [E2E_RUN_LABEL],
        });
    }
}

async function removeE2ELabel({github, context, prNumber}) {
    const {owner, repo} = repoCoords(context);

    try {
        let issueNumber = prNumber || null;

        if (!issueNumber) {
            const {data: run} = await github.rest.actions.getWorkflowRun({
                owner,
                repo,
                run_id: context.runId,
            });

            if (run.event !== 'workflow_dispatch') {
                console.log('Label removal skipped - not workflow_dispatch');
                return;
            }

            issueNumber = await resolvePrNumberFromRun({github, owner, repo, run});
        }

        if (!issueNumber) {
            console.log('Label removal skipped - could not find associated PR');
            return;
        }

        await removeE2ERunLabelSafe({github, owner, repo, prNumber: issueNumber});
    } catch (error) {
        if (error.status === 404) {
            console.log(`Label removal skipped - not found (404): ${error.message}`);
        } else if (error.status === 403) {
            console.log(`Label removal failed - insufficient permissions (403): ${error.message}`);
        } else {
            console.log(`Label removal failed: status=${error.status}, message=${error.message}`);
        }
    }
}

module.exports = {
    updateInitialStatus,
    updateFinalStatus,
    removeE2ELabel,
    handleE2EPrSync,
    formatStatusDescription,
    E2E_STATUS_CONTEXTS,
    SUPERSEDED_DESCRIPTION,
};
