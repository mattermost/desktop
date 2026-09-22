// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/github-actions.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
    it('shards linux×3, macos×3, windows×3', () => {
        assert.deepEqual(E2E_PLAYWRIGHT_SHARDS, {linux: 3, macos: 3, windows: 3});
    });
});

describe('expandPlatformShards', () => {
    it('expands each OS into i-of-n rows and keeps runner/url', () => {
        const rows = expandPlatformShards(threeOs);
        assert.equal(rows.length, 9);
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
            '1-of-3',
            '2-of-3',
            '3-of-3',
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'windows').map((r) => r.shardDisplay), [
            '1/3',
            '2/3',
            '3/3',
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
    it('counts 9 shards + 2 policy = 11 for a full Matterwick PR matrix', () => {
        assert.equal(totalReportsExpected(threeOs), 11);
    });

    it('omits policy when asked', () => {
        assert.equal(totalReportsExpected(threeOs, {includePolicy: false}), 9);
    });

    it('must not be used for CMT totals (CMT is unsharded env × server, not these shard counts)', () => {
        // compatibility-matrix-testing.yml uses jq `(.environment|length)*(.server|length)`
        // and leaves template `shard` at 1-of-1. Feeding a 3-OS list into this helper
        // would inflate the TSIO group to 11. Keep that path off CMT.
        assert.equal(totalReportsExpected(threeOs), 11);
        assert.notEqual(3, totalReportsExpected(threeOs, {includePolicy: false}));
    });
});

describe('prepareE2eMatrix', () => {
    it('groups shards by OS and reports counts', () => {
        const matrix = prepareE2eMatrix(threeOs);
        assert.equal(matrix.linux.length, 3);
        assert.equal(matrix.macos.length, 3);
        assert.equal(matrix.windows.length, 3);
        assert.equal(matrix.linuxShardCount, 3);
        assert.equal(matrix.macosShardCount, 3);
        assert.equal(matrix.windowsShardCount, 3);
        assert.equal(matrix.totalReportsExpected, 11);
        assert.equal(matrix.linux[0].shard, '1-of-3');
        assert.equal(matrix.linux[0].shardDisplay, '1/3');
        assert.equal(matrix.windows[2].shard, '3-of-3');
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

    it('returns true when a newer run has the same E2E PR run-name', async () => {
        let listed;
        const github = {
            rest: {
                actions: {
                    getWorkflowRun: async () => ({
                        data: {
                            id: 10,
                            workflow_id: 99,
                            head_branch: 'master',
                            event: 'workflow_dispatch',
                            display_title: 'E2E PR 4012',
                        },
                    }),
                    listWorkflowRuns: async (args) => {
                        listed = args;
                        return {
                            data: {
                                workflow_runs: [
                                    {id: 11, display_title: 'E2E PR 4012', head_branch: 'master'},
                                    {id: 10, display_title: 'E2E PR 4012', head_branch: 'master'},
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
        assert.equal(listed.event, 'workflow_dispatch');
        assert.equal(listed.branch, undefined);
    });

    it('returns false when this is the newest run for that PR', async () => {
        const github = mockGithub({
            thisRun: {
                id: 11,
                workflow_id: 99,
                head_branch: 'master',
                event: 'workflow_dispatch',
                display_title: 'E2E PR 4012',
            },
            workflowRuns: [
                {id: 11, display_title: 'E2E PR 4012', head_branch: 'master'},
                {id: 10, display_title: 'E2E PR 4012', head_branch: 'master'},
            ],
        });
        const result = await isWorkflowRunSuperseded({
            github,
            context: {repo: {owner: 'mattermost', repo: 'desktop'}, runId: 11},
            compositeIdentity: {name: 'desktop-pr'},
        });
        assert.equal(result, false);
    });

    it('returns false when a newer run is a different PR on the same dispatch ref', async () => {
        const github = mockGithub({
            thisRun: {
                id: 10,
                workflow_id: 99,
                head_branch: 'master',
                event: 'workflow_dispatch',
                display_title: 'E2E PR 4012',
            },
            workflowRuns: [
                {id: 12, display_title: 'E2E PR 3998', head_branch: 'master'},
                {id: 13, display_title: `E2E ${'a'.repeat(40)}`, head_branch: 'master'},
            ],
        });
        const result = await isWorkflowRunSuperseded({
            github,
            context: prContext,
            compositeIdentity: {name: 'desktop-pr'},
        });
        assert.equal(result, false);
    });

    it('uses gh_pr_number when this run has no E2E PR display_title yet', async () => {
        const github = mockGithub({
            thisRun: {
                id: 10,
                workflow_id: 99,
                head_branch: 'master',
                event: 'workflow_dispatch',
                display_title: 'Electron Playwright Tests',
            },
            workflowRuns: [
                {id: 11, display_title: 'E2E PR 4012', head_branch: 'master'},
            ],
        });
        const result = await isWorkflowRunSuperseded({
            github,
            context: prContext,
            compositeIdentity: {name: 'desktop-pr', gh_pr_number: '4012'},
        });
        assert.equal(result, true);
    });

    it('returns false for desktop-pr with no PR number (fail-open)', async () => {
        let listed = false;
        const github = {
            rest: {
                actions: {
                    getWorkflowRun: async () => ({
                        data: {
                            id: 10,
                            workflow_id: 99,
                            head_branch: 'master',
                            event: 'workflow_dispatch',
                            display_title: 'E2E deadbeef',
                        },
                    }),
                    listWorkflowRuns: async () => {
                        listed = true;
                        return {data: {workflow_runs: [{id: 11, display_title: 'E2E deadbeef'}]}};
                    },
                },
            },
        };
        const result = await isWorkflowRunSuperseded({
            github,
            context: prContext,
            compositeIdentity: {name: 'desktop-pr'},
        });
        assert.equal(result, false);
        assert.equal(listed, false);
    });

    it('returns true for CMT when a newer run exists on the same branch', async () => {
        let listed;
        const github = {
            rest: {
                actions: {
                    getWorkflowRun: async () => ({
                        data: {
                            id: 10,
                            workflow_id: 88,
                            head_branch: 'release-5.12',
                            event: 'workflow_dispatch',
                        },
                    }),
                    listWorkflowRuns: async (args) => {
                        listed = args;
                        return {
                            data: {
                                workflow_runs: [
                                    {id: 11, head_branch: 'release-5.12'},
                                    {id: 10, head_branch: 'release-5.12'},
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
            compositeIdentity: {name: 'cmt-desktop'},
        });
        assert.equal(result, true);
        assert.equal(listed.workflow_id, 88);
        assert.equal(listed.branch, 'release-5.12');
        assert.equal(listed.event, 'workflow_dispatch');
    });

    it('returns false when CMT head_branch is missing', async () => {
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
            compositeIdentity: {name: 'desktop-pr', gh_pr_number: '4012'},
        });
        assert.equal(result, false);
    });
});

const TEMPLATE_JOB_NAME = "e2e-on-${{ inputs.runs-on }}-${{ inputs.MM_SERVER_VERSION }}${{ inputs.shard != '1-of-1' && format('-{0}', inputs.shard) || '' }}";
const POLICY_JOB_NAME = 'policy-tests-${{ matrix.platform }}';

describe('TSIO gh-job-name equals GHA job runtime name', () => {
    it('nested template job name equals E2E_GH_JOB_NAME', () => {
        const yml = fs.readFileSync(path.join(__dirname, '../../.github/workflows/e2e-functional-template.yml'), 'utf8');
        const name = yml.match(/^    name: (e2e-on-.+)$/m);
        const env = yml.match(/^\s+E2E_GH_JOB_NAME: (e2e-on-.+)$/m);
        assert.ok(name, 'template job name must be e2e-on-…');
        assert.ok(env, 'E2E_GH_JOB_NAME must be e2e-on-…');
        assert.equal(name[1], env[1]);
        assert.equal(name[1], TEMPLATE_JOB_NAME);
    });

    it('policy job name equals gh-job-name', () => {
        const yml = fs.readFileSync(path.join(__dirname, '../../.github/workflows/e2e-functional.yml'), 'utf8');
        const name = yml.match(/^    name: (policy-tests-\$\{\{ matrix\.platform \}\})$/m);
        const gh = yml.match(/^\s+gh-job-name: (policy-tests-\$\{\{ matrix\.platform \}\})$/m);
        assert.ok(name, 'policy job name must be policy-tests-<platform>');
        assert.ok(gh, 'policy gh-job-name must be policy-tests-<platform>');
        assert.equal(name[1], gh[1]);
        assert.equal(name[1], POLICY_JOB_NAME);
    });

    it('caller job titles stay human-readable (TSIO matches the last / segment)', () => {
        const yml = fs.readFileSync(path.join(__dirname, '../../.github/workflows/e2e-functional.yml'), 'utf8');
        assert.match(yml, /name: E2E Linux \(\$\{\{ matrix\.shardDisplay \}\}\)/);
        assert.match(yml, /name: E2E macOS \(\$\{\{ matrix\.shardDisplay \}\}\)/);
        assert.match(yml, /name: E2E Windows \(\$\{\{ matrix\.shardDisplay \}\}\)/);
    });

    it('run-name encodes the PR concurrency key', () => {
        const yml = fs.readFileSync(path.join(__dirname, '../../.github/workflows/e2e-functional.yml'), 'utf8');
        assert.ok(yml.includes("run-name: ${{ inputs.pr_number != '' && format('E2E PR {0}', inputs.pr_number) || format('E2E {0}', github.sha) }}"));
    });
});
