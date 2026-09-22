// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/github-actions.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    expandPlatformShards,
    totalReportsExpected,
    prepareE2eMatrix,
    isWorkflowRunSuperseded,
    E2E_PLAYWRIGHT_SHARDS,
} = require('./github-actions');

const threeOs = [
    {platform: 'linux', runner: 'ubuntu-latest', url: 'https://linux.example'},
    {platform: 'macos', runner: 'macos-26', url: 'https://macos.example'},
    {platform: 'windows', runner: 'windows-2022', url: 'https://windows.example'},
];

describe('E2E_PLAYWRIGHT_SHARDS', () => {
    it('shards linux×3, macos×3, windows×2', () => {
        assert.deepEqual(E2E_PLAYWRIGHT_SHARDS, {linux: 3, macos: 3, windows: 2});
    });
});

describe('expandPlatformShards', () => {
    it('expands each OS into i-of-n rows and keeps runner/url', () => {
        const rows = expandPlatformShards(threeOs);
        assert.equal(rows.length, 8);
        assert.deepEqual(rows.filter((r) => r.platform === 'linux').map((r) => r.shard), [
            '1-of-3',
            '2-of-3',
            '3-of-3',
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'linux').map((r) => r.shardDisplay), [
            '1/3',
            '2/3',
            '3/3',
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'macos').map((r) => r.shard), [
            '1-of-3',
            '2-of-3',
            '3-of-3',
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'windows').map((r) => r.shard), [
            '1-of-2',
            '2-of-2',
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'windows').map((r) => r.shardDisplay), [
            '1/2',
            '2/2',
        ]);
        assert.ok(rows.every((r) => r.runner && r.url));
    });

    it('canonicalizes runner-only rows', () => {
        const rows = expandPlatformShards([{runner: 'ubuntu-24.04', url: 'https://x'}]);
        assert.equal(rows.length, 3);
        assert.ok(rows.every((r) => r.platform === 'linux'));
    });
});

describe('totalReportsExpected', () => {
    it('counts 8 shards + 2 policy = 10 for a full Matterwick PR matrix', () => {
        assert.equal(totalReportsExpected(threeOs), 10);
    });

    it('omits policy when asked', () => {
        assert.equal(totalReportsExpected(threeOs, {includePolicy: false}), 8);
    });

    it('must not be used for CMT totals (CMT is unsharded env × server, not these shard counts)', () => {
        // compatibility-matrix-testing.yml uses jq `(.environment|length)*(.server|length)`
        // and leaves template `shard` at 1-of-1. Feeding a 3-OS list into this helper
        // would inflate the TSIO group to 10. Keep that path off CMT.
        assert.equal(totalReportsExpected(threeOs), 10);
        assert.notEqual(3, totalReportsExpected(threeOs, {includePolicy: false}));
    });
});

describe('prepareE2eMatrix', () => {
    it('groups shards by OS and reports counts', () => {
        const matrix = prepareE2eMatrix(threeOs);
        assert.equal(matrix.linux.length, 3);
        assert.equal(matrix.macos.length, 3);
        assert.equal(matrix.windows.length, 2);
        assert.equal(matrix.linuxShardCount, 3);
        assert.equal(matrix.macosShardCount, 3);
        assert.equal(matrix.windowsShardCount, 2);
        assert.equal(matrix.totalReportsExpected, 10);
        assert.equal(matrix.linux[0].shard, '1-of-3');
        assert.equal(matrix.linux[0].shardDisplay, '1/3');
        assert.equal(matrix.windows[1].shard, '2-of-2');
    });

    it('leaves missing OS matrices empty', () => {
        const matrix = prepareE2eMatrix([{platform: 'linux', runner: 'ubuntu-latest'}]);
        assert.equal(matrix.linux.length, 3);
        assert.deepEqual(matrix.macos, []);
        assert.deepEqual(matrix.windows, []);
        assert.equal(matrix.totalReportsExpected, 5);
    });
});

function mockGithub({thisRun, workflowRuns, throwOnGet}) {
    return {
        rest: {
            actions: {
                getWorkflowRun: async () => {
                    if (throwOnGet) {
                        throw new Error('api down');
                    }
                    return {data: thisRun};
                },
                listWorkflowRuns: async () => ({data: {workflow_runs: workflowRuns}}),
            },
        },
    };
}

const prContext = {repo: {owner: 'mattermost', repo: 'desktop'}, runId: 10};

describe('isWorkflowRunSuperseded', () => {
    it('returns false for desktop-master without calling the API', async () => {
        let called = false;
        const github = {
            rest: {
                actions: {
                    getWorkflowRun: async () => {
                        called = true;
                        return {data: {}};
                    },
                },
            },
        };
        const result = await isWorkflowRunSuperseded({
            github,
            context: prContext,
            compositeIdentity: {name: 'desktop-master'},
        });
        assert.equal(result, false);
        assert.equal(called, false);
    });

    it('returns true when a newer run exists on the same branch', async () => {
        let listed;
        const github = {
            rest: {
                actions: {
                    getWorkflowRun: async () => ({
                        data: {
                            id: 10,
                            workflow_id: 99,
                            head_branch: 'fix/e2e-ci-speed-47e4',
                            event: 'workflow_dispatch',
                        },
                    }),
                    listWorkflowRuns: async (args) => {
                        listed = args;
                        return {
                            data: {
                                workflow_runs: [
                                    {id: 11, head_branch: 'fix/e2e-ci-speed-47e4'},
                                    {id: 10, head_branch: 'fix/e2e-ci-speed-47e4'},
                                ],
                            },
                        };
                    },
                },
            },
        };
        const result = await isWorkflowRunSuperseded({
            github,
            context: prContext,
            compositeIdentity: {name: 'desktop-pr'},
        });
        assert.equal(result, true);
        assert.equal(listed.workflow_id, 99);
        assert.equal(listed.branch, 'fix/e2e-ci-speed-47e4');
        assert.equal(listed.event, 'workflow_dispatch');
    });

    it('returns false when this is the newest run on the branch', async () => {
        const github = mockGithub({
            thisRun: {
                id: 11,
                workflow_id: 99,
                head_branch: 'fix/e2e-ci-speed-47e4',
                event: 'workflow_dispatch',
            },
            workflowRuns: [
                {id: 11, head_branch: 'fix/e2e-ci-speed-47e4'},
                {id: 10, head_branch: 'fix/e2e-ci-speed-47e4'},
            ],
        });
        const result = await isWorkflowRunSuperseded({
            github,
            context: {repo: {owner: 'mattermost', repo: 'desktop'}, runId: 11},
            compositeIdentity: {name: 'desktop-pr'},
        });
        assert.equal(result, false);
    });

    it('returns false for an older run on a different branch', async () => {
        const github = mockGithub({
            thisRun: {
                id: 10,
                workflow_id: 99,
                head_branch: 'fix/e2e-ci-speed-47e4',
                event: 'workflow_dispatch',
            },
            workflowRuns: [
                {id: 12, head_branch: 'other-pr'},
            ],
        });
        const result = await isWorkflowRunSuperseded({
            github,
            context: prContext,
            compositeIdentity: {name: 'desktop-pr'},
        });
        assert.equal(result, false);
    });

    it('returns false when head_branch is missing', async () => {
        const github = mockGithub({
            thisRun: {id: 10, workflow_id: 99, event: 'workflow_dispatch'},
            workflowRuns: [{id: 11, head_branch: 'master'}],
        });
        const result = await isWorkflowRunSuperseded({
            github,
            context: prContext,
            compositeIdentity: {name: 'cmt-desktop'},
        });
        assert.equal(result, false);
    });

    it('returns false on API error (fail-open so hangs still notify)', async () => {
        const github = mockGithub({throwOnGet: true, thisRun: {}, workflowRuns: []});
        const result = await isWorkflowRunSuperseded({
            github,
            context: prContext,
            compositeIdentity: {name: 'desktop-pr'},
        });
        assert.equal(result, false);
    });
});
