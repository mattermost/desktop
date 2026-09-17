// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    runBelongsToPr,
    prNumberFromRunTitle,
    cancelActiveE2ERuns,
    removeE2ELabel,
} = require('./github-actions');

const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);

describe('prNumberFromRunTitle', () => {
    it('reads the PR number from display_title or name', () => {
        assert.equal(prNumberFromRunTitle({display_title: `E2E PR #42 @ ${sha}`}), 42);
        assert.equal(prNumberFromRunTitle({name: `E2E PR #7 @ ${sha}`}), 7);
        assert.equal(prNumberFromRunTitle({name: 'Electron Playwright Tests', display_title: 'E2E'}), null);
        assert.equal(prNumberFromRunTitle({display_title: `E2E PR #42 @ ${sha} extra`}), null);
    });
});

describe('runBelongsToPr', () => {
    it('matches title identity and ignores head_branch for ownership', () => {
        const run = {display_title: `E2E PR #42 @ ${sha}`, head_branch: 'master'};
        assert.equal(runBelongsToPr(run, 42, 'fork-feature'), true);
        assert.equal(runBelongsToPr(run, 43, 'fork-feature'), false);
    });

    it('allows legacy same-repo feature-branch runs without a title', () => {
        const run = {name: 'E2E', display_title: 'E2E', head_branch: 'feature'};
        assert.equal(runBelongsToPr(run, 42, 'feature'), true);
        assert.equal(runBelongsToPr(run, 42, 'master'), false);
    });

    it('never treats unidentified master runs as belonging to a PR', () => {
        const run = {name: 'Electron Playwright Tests', display_title: 'Electron Playwright Tests', head_branch: 'master'};
        assert.equal(runBelongsToPr(run, 42, 'master'), false);
        assert.equal(runBelongsToPr(run, 42, 'feature'), false);
    });

    it('matches PR identity on name when display_title is a non-empty YAML name', () => {
        const run = {display_title: 'E2E', name: `E2E PR #42 @ ${sha}`, head_branch: 'master'};
        assert.equal(runBelongsToPr(run, 42, 'fork-feature'), true);
        assert.equal(prNumberFromRunTitle(run), 42);
    });

    it('does not match a titled other-PR run even when head_branch equals this PR branch', () => {
        const run = {display_title: `E2E PR #43 @ ${sha}`, head_branch: 'feature'};
        assert.equal(runBelongsToPr(run, 42, 'feature'), false);
        assert.equal(runBelongsToPr(run, 43, 'feature'), true);
    });
});

describe('cancelActiveE2ERuns', () => {
    it('lists without a branch filter and cancels title or legacy matches', async () => {
        const listed = [];
        const cancelled = [];
        const github = {
            rest: {
                actions: {
                    listRepoWorkflows: async () => ({data: {workflows: [{id: 9, name: 'Electron Playwright Tests'}]}}),
                    listWorkflowRuns: async (params) => {
                        listed.push(params);
                        if (params.page > 1) {
                            return {data: {workflow_runs: []}};
                        }
                        return {
                            data: {
                                workflow_runs: [
                                    {id: 1, display_title: `E2E PR #42 @ ${sha}`, head_branch: 'master', status: params.status},
                                    {id: 2, display_title: `E2E PR #43 @ ${sha}`, head_branch: 'master', status: params.status},
                                    {id: 3, name: 'E2E', display_title: 'E2E', head_branch: 'feature', status: params.status},
                                    {id: 4, name: 'E2E', display_title: 'E2E', head_branch: 'master', status: params.status},
                                    {id: 5, display_title: `E2E PR #43 @ ${otherSha}`, head_branch: 'feature', status: params.status},
                                ],
                            },
                        };
                    },
                    cancelWorkflowRun: async ({run_id: id}) => {
                        cancelled.push(id);
                    },
                },
            },
        };

        const count = await cancelActiveE2ERuns({
            github,
            context: {repo: {owner: 'mattermost', repo: 'desktop'}},
            prNumber: 42,
            headBranch: 'feature',
        });

        assert.equal(listed.every((params) => params.branch === undefined), true);
        assert.equal(listed[0].event, 'workflow_dispatch');
        assert.deepEqual(cancelled, [1, 3]);
        assert.equal(count, 2);
    });

    it('does not cancel untitled feature-branch runs when headBranch is omitted', async () => {
        const cancelled = [];
        const github = {
            rest: {
                actions: {
                    listRepoWorkflows: async () => ({data: {workflows: [{id: 9, name: 'Electron Playwright Tests'}]}}),
                    listWorkflowRuns: async (params) => {
                        if (params.page > 1) {
                            return {data: {workflow_runs: []}};
                        }
                        return {
                            data: {
                                workflow_runs: [
                                    {id: 1, display_title: `E2E PR #42 @ ${sha}`, head_branch: 'master', status: params.status},
                                    {id: 3, name: 'E2E', display_title: 'E2E', head_branch: 'feature', status: params.status},
                                    {id: 5, display_title: `E2E PR #43 @ ${sha}`, head_branch: 'feature', status: params.status},
                                ],
                            },
                        };
                    },
                    cancelWorkflowRun: async ({run_id: id}) => {
                        cancelled.push(id);
                    },
                },
            },
        };

        const count = await cancelActiveE2ERuns({
            github,
            context: {repo: {owner: 'mattermost', repo: 'desktop'}},
            prNumber: 42,
        });

        assert.deepEqual(cancelled, [1]);
        assert.equal(count, 1);
    });
});

describe('removeE2ELabel', () => {
    it('removes the label only from the titled PR', async () => {
        const removed = [];
        const github = {
            rest: {
                actions: {
                    getWorkflowRun: async () => ({
                        data: {
                            event: 'workflow_dispatch',
                            name: `E2E PR #42 @ ${sha}`,
                            display_title: `E2E PR #42 @ ${sha}`,
                            head_branch: 'master',
                            head_sha: otherSha,
                            pull_requests: [{number: 99}],
                        },
                    }),
                },
                issues: {
                    removeLabel: async ({issue_number: n}) => {
                        removed.push(n);
                    },
                },
                pulls: {
                    list: async () => {
                        assert.fail('must not associate via head: origin:master');
                    },
                },
            },
        };

        await removeE2ELabel({
            github,
            context: {repo: {owner: 'mattermost', repo: 'desktop'}, runId: 7},
        });
        assert.deepEqual(removed, [42]);
    });

    it('leaves labels alone when the title has no PR identity', async () => {
        const github = {
            rest: {
                actions: {
                    getWorkflowRun: async () => ({
                        data: {
                            event: 'workflow_dispatch',
                            name: 'Electron Playwright Tests',
                            display_title: 'E2E',
                            head_branch: 'master',
                            pull_requests: [{number: 99}],
                        },
                    }),
                },
                issues: {
                    removeLabel: async () => {
                        assert.fail('must not remove a label without title identity');
                    },
                },
            },
        };

        await removeE2ELabel({
            github,
            context: {repo: {owner: 'mattermost', repo: 'desktop'}, runId: 7},
        });
    });
});
