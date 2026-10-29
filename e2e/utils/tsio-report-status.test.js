// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/tsio-report-status.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    buildOsStatusTotals,
    flipPerOsCommitStatuses,
    reportUrlForStatusBucket,
    countReportsForBucket,
    shardsAreReady,
    shouldFailFromScope,
    scopedHasShardFailure,
    shouldPostPerOsCommitStatuses,
    resolveMasterMergeContext,
    statusFromTotals,
    countEmptyUploadedReports,
} = require('./tsio-report-status');

const WINDOWS_SHARD = 'e2e-on-windows-2022-master-1-of-3';

/** Linux 3-shard group: `uploaded` shards reported to TSIO, `counted` of them with per-job counts. */
function linuxShards({uploaded = 3, counted = uploaded} = {}) {
    const names = [1, 2, 3].slice(0, uploaded).map((i) => `e2e-on-ubuntu-latest-master-${i}-of-3`);
    return {
        detail: {reports: names.map((name) => ({gh_job_name: name, status: 'complete'}))},
        perJobCounts: Object.fromEntries(names.slice(0, counted).map((name) => [name, {passed: 70, failed: 0, skipped: 2, flaky: 0}])),
    };
}

/** Linux fully counted and passing; Windows shard 1 has one failed test. */
function linuxPassWindowsFail() {
    const shards = linuxShards();
    shards.detail.reports.push({gh_job_name: WINDOWS_SHARD, status: 'complete'});
    shards.perJobCounts[WINDOWS_SHARD] = {passed: 90, failed: 1, skipped: 3, flaky: 0};
    return shards;
}

describe('buildOsStatusTotals', () => {
    it('groups per-job counts and shard failures by OS, keeping policy separate', () => {
        const byKey = buildOsStatusTotals({
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-ubuntu-latest-11.9.0', status: 'complete'},
                    {gh_job_name: 'e2e-on-windows-2022-11.9.0', status: 'failed'},
                    {gh_job_name: 'policy-tests-macos', status: 'complete'},
                ],
            },
            perJobCounts: {
                'e2e-on-ubuntu-latest-11.9.0': {passed: 100, failed: 0, skipped: 5, flaky: 1},
                'e2e-on-windows-2022-11.9.0': {passed: 90, failed: 2, skipped: 5, flaky: 0},
                'policy-tests-macos': {passed: 9, failed: 0, skipped: 0, flaky: 0},
            },
        });

        assert.deepEqual(byKey.linux, {
            passed: 101,
            failed: 0,
            skipped: 5,
            shardFailed: false,
            hasResults: true,
        });
        assert.deepEqual(byKey.windows, {
            passed: 90,
            failed: 2,
            skipped: 5,
            shardFailed: true,
            hasResults: true,
        });
        assert.equal(byKey.macos, undefined);
        assert.deepEqual(byKey['macos-policy'], {
            passed: 9,
            failed: 0,
            skipped: 0,
            shardFailed: false,
            hasResults: true,
        });
    });

    it('marks an OS with no counts but a failed shard', () => {
        const byKey = buildOsStatusTotals({
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-macos-26-11.10.0', status: 'failed'},
                ],
            },
            perJobCounts: {},
        });

        assert.equal(byKey.macos.shardFailed, true);
        assert.equal(byKey.macos.hasResults, false);
    });

    it('rolls Playwright shards for one OS into a single bucket', () => {
        const byKey = buildOsStatusTotals({
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'failed'},
                ],
            },
            perJobCounts: {
                'e2e-on-ubuntu-latest-master-1-of-3': {passed: 80, failed: 0, skipped: 2, flaky: 0},
                'e2e-on-ubuntu-latest-master-2-of-3': {passed: 70, failed: 0, skipped: 3, flaky: 1},
                'e2e-on-ubuntu-latest-master-3-of-3': {passed: 60, failed: 2, skipped: 1, flaky: 0},
            },
        });

        assert.deepEqual(byKey.linux, {
            passed: 211,
            failed: 2,
            skipped: 6,
            shardFailed: true,
            hasResults: true,
        });
    });
});

describe('flipPerOsCommitStatuses', () => {
    function makeHarness() {
        const statuses = [];
        const github = {
            rest: {
                repos: {
                    createCommitStatus: async (opts) => {
                        statuses.push(opts);
                    },
                },
            },
        };
        const core = {warning: () => {}};
        const context = {repo: {owner: 'mattermost', repo: 'desktop'}};
        const compositeIdentity = {commit_sha: 'abc123'};
        return {statuses, github, core, context, compositeIdentity};
    }

    it('maps success / failure from per-OS counts', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {reports: []},
            perJobCounts: {
                'e2e-on-ubuntu-latest-11.9.0': {passed: 10, failed: 0, skipped: 1, flaky: 0},
                'e2e-on-windows-2022-11.9.0': {passed: 8, failed: 2, skipped: 0, flaky: 0},
            },
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux', 'windows'],
            core,
        });

        const byContext = Object.fromEntries(statuses.map((s) => [s.context, s]));
        assert.equal(statuses.length, 2);
        assert.equal(byContext['e2e/linux'].state, 'success');
        assert.match(byContext['e2e/linux'].description, /10 passed, 0 failed/);
        assert.equal(byContext['e2e/windows'].state, 'failure');
        assert.match(byContext['e2e/windows'].description, /8 passed, 2 failed/);
    });

    // Regression: PR/master runs name their legs e2e-on-<runner>-master. Those job
    // names used to fail to parse, so every e2e/<os> came back "E2E incomplete — no
    // results for this OS" while e2e/<os>-policy showed real counts.
    it('flips real counts for legs whose server version is a branch ref', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-ubuntu-latest-master', status: 'complete'},
                    {gh_job_name: 'e2e-on-macos-26-master', status: 'complete'},
                    {gh_job_name: 'e2e-on-windows-2022-master', status: 'complete'},
                ],
            },
            perJobCounts: {
                'e2e-on-ubuntu-latest-master': {passed: 234, failed: 1, skipped: 8, flaky: 0},
                'e2e-on-macos-26-master': {passed: 228, failed: 0, skipped: 18, flaky: 0},
                'e2e-on-windows-2022-master': {passed: 240, failed: 0, skipped: 17, flaky: 2},
            },
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux', 'macos', 'windows'],
            core,
        });

        const byContext = Object.fromEntries(statuses.map((s) => [s.context, s]));
        assert.equal(byContext['e2e/linux'].state, 'failure');
        assert.match(byContext['e2e/linux'].description, /234 passed, 1 failed, 8 skipped/);
        assert.equal(byContext['e2e/macos'].state, 'success');
        assert.match(byContext['e2e/macos'].description, /228 passed, 0 failed, 18 skipped/);
        assert.equal(byContext['e2e/windows'].state, 'success');
        assert.match(byContext['e2e/windows'].description, /242 passed, 0 failed, 17 skipped/);

        for (const status of statuses) {
            assert.doesNotMatch(status.description, /incomplete/i);
        }
    });

    it('flips separate e2e/<os>-policy contexts', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {
                reports: [
                    {gh_job_name: 'policy-tests-windows', status: 'failed'},
                ],
            },
            perJobCounts: {
                'policy-tests-macos': {passed: 14, failed: 0, skipped: 0, flaky: 0},
                'policy-tests-windows': {passed: 10, failed: 1, skipped: 0, flaky: 0},
            },
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['macos'],
            expectedPolicyOs: ['macos', 'windows'],
            core,
        });

        const byContext = Object.fromEntries(statuses.map((s) => [s.context, s]));
        assert.equal(byContext['e2e/macos'].state, 'error');
        assert.equal(byContext['e2e/macos-policy'].state, 'success');
        assert.equal(byContext['e2e/windows-policy'].state, 'failure');
        assert.equal(byContext['e2e/windows'], undefined);
    });

    it('emits error when upstream succeeded but OS has no results', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {reports: []},
            perJobCounts: {},
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['macos'],
            core,
        });

        assert.equal(statuses.length, 1);
        assert.equal(statuses[0].context, 'e2e/macos');
        assert.equal(statuses[0].state, 'error');
        assert.match(statuses[0].description, /incomplete/i);
    });

    it('emits failure when upstream failed and OS has no results', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {reports: []},
            perJobCounts: {},
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: false,
            expectedOs: ['linux'],
            core,
        });

        assert.equal(statuses.length, 1);
        assert.equal(statuses[0].state, 'failure');
        assert.match(statuses[0].description, /untracked by TSIO/i);
    });

    it('falls back to three OS contexts when expectedOs is empty and there are no results', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {reports: []},
            perJobCounts: {},
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: [],
            core,
        });

        const contexts = statuses.map((s) => s.context).sort();
        assert.deepEqual(contexts, ['e2e/linux', 'e2e/macos', 'e2e/windows']);
        assert.ok(statuses.every((s) => s.state === 'error'));
    });

    it('does not flip policy contexts when expectedPolicyOs is omitted', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {reports: []},
            perJobCounts: {
                'policy-tests-macos': {passed: 1, failed: 0, skipped: 0, flaky: 0},
            },
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux'],
            core,
        });

        assert.deepEqual(statuses.map((s) => s.context), ['e2e/linux']);
    });

    it('points each check at its individual TSIO report, not the group URL', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {
                reports: [
                    {id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-11.9.0', status: 'complete'},
                    {id: 'rid-mac', gh_job_name: 'e2e-on-macos-14-11.9.0', status: 'complete'},
                    {id: 'rid-win', gh_job_name: 'e2e-on-windows-2022-11.9.0', status: 'complete'},
                    {id: 'rid-mac-policy', gh_job_name: 'policy-tests-macos', status: 'complete'},
                    {id: 'rid-win-policy', gh_job_name: 'policy-tests-windows', status: 'complete'},
                ],
            },
            perJobCounts: {
                'e2e-on-ubuntu-latest-11.9.0': {passed: 219, failed: 0, skipped: 11, flaky: 0},
                'e2e-on-macos-14-11.9.0': {passed: 225, failed: 0, skipped: 20, flaky: 0},
                'e2e-on-windows-2022-11.9.0': {passed: 236, failed: 0, skipped: 20, flaky: 0},
                'policy-tests-macos': {passed: 9, failed: 0, skipped: 0, flaky: 0},
                'policy-tests-windows': {passed: 9, failed: 0, skipped: 0, flaky: 0},
            },
            targetUrl: 'https://test-io.test.mattermost.com/reports/desktop/pr/abc1234/desktop-pr',
            baseUrl: 'https://test-io.test.mattermost.com',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux', 'macos', 'windows'],
            expectedPolicyOs: ['macos', 'windows'],
            core,
        });

        const byContext = Object.fromEntries(statuses.map((s) => [s.context, s]));
        assert.equal(byContext['e2e/linux'].target_url, 'https://test-io.test.mattermost.com/reports/r/rid-linux');
        assert.equal(byContext['e2e/macos'].target_url, 'https://test-io.test.mattermost.com/reports/r/rid-mac');
        assert.equal(byContext['e2e/windows'].target_url, 'https://test-io.test.mattermost.com/reports/r/rid-win');
        assert.equal(byContext['e2e/macos-policy'].target_url, 'https://test-io.test.mattermost.com/reports/r/rid-mac-policy');
        assert.equal(byContext['e2e/windows-policy'].target_url, 'https://test-io.test.mattermost.com/reports/r/rid-win-policy');
    });

    it('names the run on OS statuses, so E2E triage may write on them', async () => {
        const {statuses, github, core, context} = makeHarness();
        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity: {commit_sha: 'abc123', gh_run_id: '36856001789', gh_run_attempt: '2'},
            detail: {reports: [{id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-11.9.0', status: 'complete'}]},
            perJobCounts: {'e2e-on-ubuntu-latest-11.9.0': {passed: 1, failed: 0, skipped: 0, flaky: 0}},
            targetUrl: 'https://test-io.test.mattermost.com/reports/desktop/pr/abc1234/desktop-pr',
            baseUrl: 'https://test-io.test.mattermost.com',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux'],
            core,
        });
        assert.equal(statuses[0].target_url, 'https://test-io.test.mattermost.com/reports/r/rid-linux?gh_run_id=36856001789&gh_run_attempt=2');
    });

    it('returns the report url unchanged when gh_run_attempt is missing, rather than guessing attempt 1', async () => {
        const {statuses, github, core, context} = makeHarness();
        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity: {commit_sha: 'abc123', gh_run_id: '36856001789'},
            detail: {reports: [{id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-11.9.0', status: 'complete'}]},
            perJobCounts: {'e2e-on-ubuntu-latest-11.9.0': {passed: 1, failed: 0, skipped: 0, flaky: 0}},
            targetUrl: 'https://test-io.test.mattermost.com/reports/desktop/pr/abc1234/desktop-pr',
            baseUrl: 'https://test-io.test.mattermost.com',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux'],
            core,
        });
        assert.equal(statuses[0].target_url, 'https://test-io.test.mattermost.com/reports/r/rid-linux');
    });

    it('falls back to the group URL when a bucket has no uploaded report id', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();
        const groupUrl = 'https://test-io.test.mattermost.com/reports/desktop/pr/abc1234/desktop-pr';

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {reports: []},
            perJobCounts: {
                'e2e-on-ubuntu-latest-11.9.0': {passed: 1, failed: 0, skipped: 0, flaky: 0},
            },
            targetUrl: groupUrl,
            baseUrl: 'https://test-io.test.mattermost.com',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux'],
            core,
        });

        assert.equal(statuses[0].target_url, groupUrl);
    });

    async function flip(args) {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();
        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            core,
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            ...args,
        });
        return statuses;
    }

    const linuxScope = {expectedOs: ['linux'], readyWhenOs: 'linux', minReports: 3};

    it('does not flip e2e/linux green when a shard report is missing', async () => {
        const statuses = await flip({...linuxShards({uploaded: 2}), ...linuxScope, upstreamJobsSucceeded: false});
        assert.equal(statuses.length, 1);
        assert.notEqual(statuses[0].state, 'success');
        assert.match(statuses[0].description, /2\/3/);
    });

    it('flips e2e/linux green only when all shards uploaded and upstream succeeded', async () => {
        const statuses = await flip({...linuxShards(), ...linuxScope});
        assert.equal(statuses.length, 1);
        assert.equal(statuses[0].state, 'success');
        assert.match(statuses[0].description, /210 passed, 0 failed, 6 skipped/);
    });

    it('posts error, not success, when tests failed and per-job counts are missing or incomplete', async () => {
        for (const counted of [0, 2]) {
            const statuses = await flip({
                ...linuxShards({counted}),
                ...linuxScope,
                hasPerJobCounts: counted > 0,
                overallFailed: 4,
            });
            assert.equal(statuses[0].state, 'error', `counted=${counted}`);
            assert.match(statuses[0].description, /per-job counts unavailable/i);
        }
    });

    it('posts success for a fully counted passing OS when another OS failed', async () => {
        const statuses = await flip({
            ...linuxPassWindowsFail(),
            expectedOs: ['linux', 'windows'],
            hasPerJobCounts: true,
            overallFailed: 1,
        });
        const byContext = Object.fromEntries(statuses.map((s) => [s.context, s]));
        assert.equal(byContext['e2e/linux'].state, 'success');
        assert.equal(byContext['e2e/windows'].state, 'failure');
    });
});

describe('reportUrlForStatusBucket', () => {
    const baseUrl = 'https://test-io.test.mattermost.com';
    const fallback = 'https://test-io.test.mattermost.com/reports/desktop/pr/abc/desktop-pr';

    it('returns the individual report URL when a bucket has one uploaded report', () => {
        const url = reportUrlForStatusBucket({
            reports: [
                {id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-11.9.0'},
                {id: 'rid-mac', gh_job_name: 'e2e-on-macos-14-11.9.0'},
            ],
            bucketKey: 'linux',
            baseUrl,
            fallbackUrl: fallback,
        });
        assert.equal(url, `${baseUrl}/reports/r/rid-linux`);
    });

    it('prefers a failed individual report when a bucket has multiple uploads', () => {
        const url = reportUrlForStatusBucket({
            reports: [
                {id: 'rid-linux-a', gh_job_name: 'e2e-on-ubuntu-latest-11.9.0', status: 'complete'},
                {id: 'rid-linux-b', gh_job_name: 'e2e-on-ubuntu-latest-11.10.0', status: 'failed'},
            ],
            bucketKey: 'linux',
            baseUrl,
            fallbackUrl: fallback,
        });
        assert.equal(url, `${baseUrl}/reports/r/rid-linux-b`);
    });

    it('keeps the group URL when a bucket has multiple successful uploads', () => {
        const url = reportUrlForStatusBucket({
            reports: [
                {id: 'rid-linux-a', gh_job_name: 'e2e-on-ubuntu-latest-11.9.0', status: 'complete'},
                {id: 'rid-linux-b', gh_job_name: 'e2e-on-ubuntu-latest-11.10.0', status: 'complete'},
            ],
            bucketKey: 'linux',
            baseUrl,
            fallbackUrl: fallback,
        });
        assert.equal(url, fallback);
    });
});

describe('countReportsForBucket / shardsAreReady', () => {
    const {detail} = linuxShards();
    detail.reports.push({gh_job_name: 'policy-tests-macos', status: 'complete'});

    it('counts only the requested OS bucket', () => {
        assert.equal(countReportsForBucket(detail, 'linux'), 3);
        assert.equal(countReportsForBucket(detail, 'macos'), 0);
        assert.equal(countReportsForBucket(detail, 'macos-policy'), 1);
    });

    it('is ready for linux when 3 linux shards are present even if macos is missing', () => {
        assert.equal(shardsAreReady({detail, totalReportsExpected: 10, readyWhenOs: 'linux', minReports: 3}), true);
        assert.equal(shardsAreReady({detail, totalReportsExpected: 10}), false);
        assert.equal(shardsAreReady({
            detail: linuxShards({uploaded: 2}).detail,
            totalReportsExpected: 10,
            readyWhenOs: 'linux',
            minReports: 3,
        }), false);
    });

    it('is ready for policy when min policy reports are present', () => {
        assert.equal(shardsAreReady({detail, totalReportsExpected: 10, readyWhenPolicy: true, minReports: 2}), false);
        const policy = {reports: [{gh_job_name: 'policy-tests-macos'}, {gh_job_name: 'policy-tests-windows'}]};
        assert.equal(shardsAreReady({detail: policy, totalReportsExpected: 10, readyWhenPolicy: true, minReports: 2}), true);
    });
});

describe('shouldFailFromScope', () => {
    const linuxPass = {linux: {passed: 200, failed: 0, skipped: 5, shardFailed: false, hasResults: true}};
    const linuxFail = {linux: {passed: 198, failed: 2, skipped: 5, shardFailed: false, hasResults: true}};

    const failsLinux = (shards, extra) => shouldFailFromScope({
        failOnTestFailures: true,
        readyWhenOs: 'linux',
        upstreamJobsSucceeded: true,
        minReports: 3,
        ...shards,
        byKey: buildOsStatusTotals(shards),
        ...extra,
    });

    it('fails only the scoped OS when that OS has test failures', () => {
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            readyWhenOs: 'linux',
            overallState: 'success',
            byKey: linuxFail,
            upstreamJobsSucceeded: true,
            hasPerJobCounts: true,
        }), true);
    });

    it('fails the scoped OS when shard reports are incomplete even if uploaded tests passed', () => {
        assert.equal(failsLinux(linuxShards({uploaded: 2}), {overallState: 'success'}), true);
    });

    it('uses global overallState when no OS/policy scope is set', () => {
        const unscoped = {failOnTestFailures: true, byKey: linuxPass, upstreamJobsSucceeded: true};
        assert.equal(shouldFailFromScope({...unscoped, overallState: 'failure'}), true);
        assert.equal(shouldFailFromScope({...unscoped, overallState: 'success'}), false);
    });

    it('does not succeed a scoped OS when per-job counts are missing or incomplete and the group failed', () => {
        for (const counted of [0, 2]) {
            assert.equal(failsLinux(linuxShards({counted}), {
                overallState: 'failure',
                hasPerJobCounts: counted > 0,
                overallFailed: 2,
            }), true, `counted=${counted}`);
        }
    });

    it('keeps a fully counted passing OS green when another OS failed', () => {
        assert.equal(failsLinux(linuxPassWindowsFail(), {
            overallState: 'failure',
            hasPerJobCounts: true,
            overallFailed: 1,
        }), false);
    });
});

describe('scopedHasShardFailure', () => {
    it('ignores shard failures outside the OS being flipped', () => {
        const byKey = {
            linux: {shardFailed: false},
            macos: {shardFailed: true},
        };
        assert.equal(scopedHasShardFailure(byKey, ['linux'], []), false);
        assert.equal(scopedHasShardFailure(byKey, ['macos'], []), true);
        assert.equal(scopedHasShardFailure(byKey, null, ['macos']), false);
        assert.equal(scopedHasShardFailure({
            'macos-policy': {shardFailed: true},
            linux: {shardFailed: true},
        }, null, ['macos']), true);
    });
});

describe('resolveMasterMergeContext', () => {
    const context = {repo: {owner: 'mattermost', repo: 'desktop'}};
    const identity = {branch: 'master', commit_sha: 'a1b2c3d4', name: 'desktop-master'};
    const core = {warning: () => {}};

    const githubWithPrs = (prs, commit) => ({
        rest: {repos: {
            listPullRequestsAssociatedWithCommit: async () => ({data: prs}),
            getCommit: async () => ({data: commit}),
        }},
    });

    it('returns the merged PR for the head commit, preferring base=master', async () => {
        const result = await resolveMasterMergeContext({
            github: githubWithPrs([
                {number: 1, title: 'release PR', merged_at: '2026-01-01', base: {ref: 'release-1'}, user: {login: 'a'}, html_url: 'https://example/pr/1'},
                {number: 3916, title: 'Fix the thing', merged_at: '2026-01-02', base: {ref: 'master'}, user: {login: 'dev'}, html_url: 'https://example/pr/3916'},
                {number: 2, title: 'unmerged', merged_at: null, base: {ref: 'master'}, user: {login: 'b'}, html_url: 'https://example/pr/2'},
            ]),
            context,
            compositeIdentity: identity,
            core,
        });
        assert.deepEqual(result.mergedPr, {number: 3916, title: 'Fix the thing', url: 'https://example/pr/3916', author: 'dev'});
        assert.equal(result.headCommit, null);
    });

    it('falls back to the head-commit subject when no PR merged this commit', async () => {
        const result = await resolveMasterMergeContext({
            github: githubWithPrs([], {commit: {message: 'Direct push fix\n\nbody'}, author: {login: 'dev'}}),
            context,
            compositeIdentity: identity,
            core,
        });
        assert.equal(result.mergedPr, null);
        assert.deepEqual(result.headCommit, {subject: 'Direct push fix', author: 'dev'});
    });

    it('never throws on API failure', async () => {
        const github = {rest: {repos: {
            listPullRequestsAssociatedWithCommit: async () => {
                throw new Error('403');
            },
            getCommit: async () => {
                throw new Error('403');
            },
        }}};
        assert.deepEqual(
            await resolveMasterMergeContext({github, context, compositeIdentity: identity, core}),
            {mergedPr: null, headCommit: null},
        );
    });
});

describe('setup problem (complete report, no tests)', () => {
    it('keeps a just-completed upload with no consolidated count incomplete, not a setup failure', () => {
        const {detail, perJobCounts} = linuxShards({uploaded: 3, counted: 2});
        assert.equal(countEmptyUploadedReports(detail, perJobCounts, 'linux'), 0);
        assert.equal(countEmptyUploadedReports(detail, perJobCounts, 'windows'), 0);
        assert.equal(countEmptyUploadedReports(detail, null, 'linux'), 0, 'unavailable counts are not a setup diagnosis');
    });

    // Master run 40816626126: Linux shard 1 of 3 failed global setup at 04:16 and uploaded no tests; the e2e/linux
    // check ran at 04:26, when the other two shards' tests were in TSIO.
    it('counts a report complete for minutes with no test, while the others have tests, as a setup failure', () => {
        const {detail, perJobCounts} = linuxShards({uploaded: 3, counted: 2});
        const now = Date.parse('2026-10-29T04:26:53Z');
        detail.reports[2].updated_at = '2026-10-29T04:26:44Z';
        assert.equal(countEmptyUploadedReports(detail, perJobCounts, 'linux', now), 0, 'its tests may still be landing');
        detail.reports[2].updated_at = '2026-10-29T04:16:13Z';
        assert.equal(countEmptyUploadedReports(detail, perJobCounts, 'linux', now), 1);
        assert.equal(countEmptyUploadedReports(detail, {}, 'linux', now), 0, 'no results read at all is not a setup diagnosis');
    });

    it('counts a setup failure with explicit zero-test evidence', () => {
        const {detail, perJobCounts} = linuxShards({uploaded: 3, counted: 2});
        const missingName = 'e2e-on-ubuntu-latest-master-3-of-3';

        perJobCounts[missingName] = {passed: 0, failed: 0, skipped: 0, flaky: 0};
        assert.equal(countEmptyUploadedReports(detail, perJobCounts, 'linux'), 1, 'explicit zero counts are definitive');

        delete perJobCounts[missingName];
        detail.reports[2].test_stats = {passed: 0, failed: 0, skipped: 0, flaky: 0, total: 0};
        assert.equal(countEmptyUploadedReports(detail, perJobCounts, 'linux'), 1, 'a zero report total is definitive');
    });

    it('names the setup problem in the OS status instead of incomplete counts', () => {
        const status = statusFromTotals(
            {passed: 140, failed: 0, skipped: 4, shardFailed: false, hasResults: true},
            true,
            'E2E incomplete — no results for this OS',
            {emptyUploadedReports: 1, uploadedReports: 3, hasCountsForEveryUploadedReport: false},
        );
        assert.equal(status.state, 'error');
        assert.equal(status.description, 'Setup problem: 1 of 3 test groups ran no tests (setup failed before the first test)');
    });

    it('still reports counts incomplete when no uploaded shard is empty', () => {
        const status = statusFromTotals(
            {passed: 140, failed: 0, skipped: 4, shardFailed: false, hasResults: true},
            true,
            'E2E incomplete — no results for this OS',
            {emptyUploadedReports: 0, uploadedReports: 3, hasCountsForEveryUploadedReport: false},
        );
        assert.equal(status.description, 'TSIO per-job counts incomplete for this OS');
    });
});

describe('shouldPostPerOsCommitStatuses', () => {
    it('never flips e2e/<os> for cmt-desktop, otherwise follows the flag', () => {
        assert.equal(shouldPostPerOsCommitStatuses(true, {name: 'cmt-desktop'}), false);
        assert.equal(shouldPostPerOsCommitStatuses(true, {name: 'desktop-pr'}), true);
        assert.equal(shouldPostPerOsCommitStatuses(true, {name: 'desktop-master'}), true);
        assert.equal(shouldPostPerOsCommitStatuses(false, {name: 'desktop-pr'}), false);
        assert.equal(shouldPostPerOsCommitStatuses(true, {}), true);
        assert.equal(shouldPostPerOsCommitStatuses(false), false);
    });
});
