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
    statusFromTotals,
    scopedHasShardFailure,
} = require('./tsio-report-status');

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

    it('rolls sharded job names into e2e/linux', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'complete'},
                ],
            },
            perJobCounts: {
                'e2e-on-ubuntu-latest-master-1-of-3': {passed: 80, failed: 0, skipped: 1, flaky: 0},
                'e2e-on-ubuntu-latest-master-2-of-3': {passed: 70, failed: 0, skipped: 2, flaky: 0},
                'e2e-on-ubuntu-latest-master-3-of-3': {passed: 60, failed: 0, skipped: 3, flaky: 0},
            },
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux'],
            core,
        });

        assert.equal(statuses.length, 1);
        assert.equal(statuses[0].context, 'e2e/linux');
        assert.equal(statuses[0].state, 'success');
        assert.match(statuses[0].description, /210 passed, 0 failed, 6 skipped/);
    });

    it('does not flip e2e/linux green when a shard report is missing', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                ],
            },
            perJobCounts: {
                'e2e-on-ubuntu-latest-master-1-of-3': {passed: 80, failed: 0, skipped: 1, flaky: 0},
                'e2e-on-ubuntu-latest-master-2-of-3': {passed: 82, failed: 0, skipped: 1, flaky: 0},
            },
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: false,
            expectedOs: ['linux'],
            readyWhenOs: 'linux',
            minReports: 3,
            core,
        });

        assert.equal(statuses.length, 1);
        assert.equal(statuses[0].context, 'e2e/linux');
        assert.notEqual(statuses[0].state, 'success');
        assert.match(statuses[0].description, /2\/3/);
    });

    it('flips e2e/linux green only when all shards uploaded and upstream succeeded', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'complete'},
                ],
            },
            perJobCounts: {
                'e2e-on-ubuntu-latest-master-1-of-3': {passed: 80, failed: 0, skipped: 1, flaky: 0},
                'e2e-on-ubuntu-latest-master-2-of-3': {passed: 70, failed: 0, skipped: 2, flaky: 0},
                'e2e-on-ubuntu-latest-master-3-of-3': {passed: 60, failed: 0, skipped: 3, flaky: 0},
            },
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux'],
            readyWhenOs: 'linux',
            minReports: 3,
            core,
        });

        assert.equal(statuses[0].state, 'success');
    });

    it('posts error, not success, when shards uploaded but per-job counts are missing and tests failed', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'complete'},
                ],
            },
            perJobCounts: {},
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux'],
            readyWhenOs: 'linux',
            minReports: 3,
            hasPerJobCounts: false,
            overallFailed: 4,
            core,
        });

        assert.equal(statuses.length, 1);
        assert.equal(statuses[0].context, 'e2e/linux');
        assert.equal(statuses[0].state, 'error');
        assert.match(statuses[0].description, /per-job counts unavailable/i);
    });

    it('posts error when one uploaded shard in the bucket has no per-job counts and tests failed', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'complete'},
                ],
            },
            perJobCounts: {
                'e2e-on-ubuntu-latest-master-1-of-3': {passed: 80, failed: 0, skipped: 0, flaky: 0},
                'e2e-on-ubuntu-latest-master-2-of-3': {passed: 82, failed: 0, skipped: 0, flaky: 0},
            },
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux'],
            readyWhenOs: 'linux',
            minReports: 3,
            hasPerJobCounts: true,
            overallFailed: 2,
            core,
        });

        assert.equal(statuses[0].state, 'error');
        assert.match(statuses[0].description, /per-job counts unavailable/i);
    });

    it('posts success for a fully counted passing OS when another OS failed', async () => {
        const {statuses, github, core, context, compositeIdentity} = makeHarness();

        await flipPerOsCommitStatuses({
            github,
            context,
            compositeIdentity,
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'complete'},
                    {gh_job_name: 'e2e-on-windows-2022-master-1-of-3', status: 'complete'},
                ],
            },
            perJobCounts: {
                'e2e-on-ubuntu-latest-master-1-of-3': {passed: 80, failed: 0, skipped: 1, flaky: 0},
                'e2e-on-ubuntu-latest-master-2-of-3': {passed: 78, failed: 0, skipped: 2, flaky: 0},
                'e2e-on-ubuntu-latest-master-3-of-3': {passed: 81, failed: 0, skipped: 0, flaky: 0},
                'e2e-on-windows-2022-master-1-of-3': {passed: 90, failed: 1, skipped: 3, flaky: 0},
            },
            targetUrl: 'https://example.test/report',
            upstreamJobsSucceeded: true,
            expectedOs: ['linux', 'windows'],
            hasPerJobCounts: true,
            overallFailed: 1,
            core,
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
    const linuxShards = {
        reports: [
            {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
            {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
            {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'complete'},
            {gh_job_name: 'policy-tests-macos', status: 'complete'},
        ],
    };

    it('counts only the requested OS bucket', () => {
        assert.equal(countReportsForBucket(linuxShards, 'linux'), 3);
        assert.equal(countReportsForBucket(linuxShards, 'macos'), 0);
        assert.equal(countReportsForBucket(linuxShards, 'macos-policy'), 1);
    });

    it('is ready for linux when 3 linux shards are present even if macos is missing', () => {
        assert.equal(shardsAreReady({
            detail: linuxShards,
            totalReportsExpected: 10,
            readyWhenOs: 'linux',
            minReports: 3,
        }), true);
        assert.equal(shardsAreReady({
            detail: linuxShards,
            totalReportsExpected: 10,
        }), false);
        assert.equal(shardsAreReady({
            detail: {reports: linuxShards.reports.slice(0, 2)},
            totalReportsExpected: 10,
            readyWhenOs: 'linux',
            minReports: 3,
        }), false);
    });

    it('is ready for policy when min policy reports are present', () => {
        assert.equal(shardsAreReady({
            detail: linuxShards,
            totalReportsExpected: 10,
            readyWhenPolicy: true,
            minReports: 2,
        }), false);
        assert.equal(shardsAreReady({
            detail: {
                reports: [
                    {gh_job_name: 'policy-tests-macos', status: 'complete'},
                    {gh_job_name: 'policy-tests-windows', status: 'complete'},
                ],
            },
            totalReportsExpected: 10,
            readyWhenPolicy: true,
            minReports: 2,
        }), true);
    });
});

describe('shouldFailFromScope', () => {
    const linuxPass = {linux: {passed: 200, failed: 0, skipped: 5, shardFailed: false, hasResults: true}};
    const linuxFail = {linux: {passed: 198, failed: 2, skipped: 5, shardFailed: false, hasResults: true}};

    it('does not fail a passing OS when another OS failed in the same TSIO group', () => {
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            readyWhenOs: 'linux',
            overallState: 'failure',
            byKey: linuxPass,
            upstreamJobsSucceeded: true,
            hasPerJobCounts: true,
        }), false);
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
        const detail = {
            reports: [
                {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
            ],
        };
        const byKey = buildOsStatusTotals({
            detail,
            perJobCounts: {
                'e2e-on-ubuntu-latest-master-1-of-3': {passed: 80, failed: 0, skipped: 0, flaky: 0},
                'e2e-on-ubuntu-latest-master-2-of-3': {passed: 82, failed: 0, skipped: 0, flaky: 0},
            },
        });
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            readyWhenOs: 'linux',
            overallState: 'success',
            byKey,
            upstreamJobsSucceeded: true,
            minReports: 3,
            detail,
        }), true);
    });

    it('uses global overallState when no OS/policy scope is set', () => {
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            overallState: 'failure',
            byKey: linuxPass,
            upstreamJobsSucceeded: true,
        }), true);
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            overallState: 'success',
            byKey: linuxPass,
            upstreamJobsSucceeded: true,
        }), false);
    });

    it('does not succeed a scoped OS when per-job counts are missing and the group failed tests', () => {
        const detail = {
            reports: [
                {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'complete'},
            ],
            test_stats: {failed: 4, passed: 200, skipped: 5, total: 209},
        };
        const byKey = buildOsStatusTotals({detail, perJobCounts: {}});
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            readyWhenOs: 'linux',
            overallState: 'failure',
            byKey,
            upstreamJobsSucceeded: true,
            minReports: 3,
            detail,
            hasPerJobCounts: false,
            overallFailed: 4,
        }), true);

        const uploaded = countReportsForBucket(detail, 'linux');
        assert.equal(statusFromTotals(
            byKey.linux || {passed: 0, failed: 0, skipped: 0, shardFailed: false, hasResults: false},
            true,
            'E2E incomplete — no results for this OS',
            {minReports: 3, uploadedReports: uploaded, hasPerJobCounts: false, overallFailed: 4},
        ).state, 'error');
    });

    it('still succeeds a passing OS when another OS failed and per-job counts exist', () => {
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            readyWhenOs: 'linux',
            overallState: 'failure',
            byKey: linuxPass,
            upstreamJobsSucceeded: true,
            hasPerJobCounts: true,
            overallFailed: 4,
        }), false);
    });

    it('does not succeed a scoped OS when one uploaded shard lacks per-job counts and the group failed', () => {
        const detail = {
            reports: [
                {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'complete'},
            ],
            test_stats: {failed: 2, passed: 200, skipped: 5, total: 207},
        };
        const perJobCounts = {
            'e2e-on-ubuntu-latest-master-1-of-3': {passed: 80, failed: 0, skipped: 0, flaky: 0},
            'e2e-on-ubuntu-latest-master-2-of-3': {passed: 82, failed: 0, skipped: 0, flaky: 0},
        };
        const byKey = buildOsStatusTotals({detail, perJobCounts});
        assert.equal(byKey.linux.hasResults, true);
        assert.equal(byKey.linux.failed, 0);
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            readyWhenOs: 'linux',
            overallState: 'failure',
            byKey,
            upstreamJobsSucceeded: true,
            minReports: 3,
            detail,
            perJobCounts,
            hasPerJobCounts: true,
            overallFailed: 2,
        }), true);
        assert.equal(statusFromTotals(
            byKey.linux,
            true,
            'E2E incomplete — no results for this OS',
            {
                minReports: 3,
                uploadedReports: 3,
                hasPerJobCounts: true,
                hasCountsForEveryUploadedReport: false,
                overallFailed: 2,
            },
        ).state, 'error');
    });

    it('keeps a fully counted passing OS green when another OS failed', () => {
        const detail = {
            reports: [
                {gh_job_name: 'e2e-on-ubuntu-latest-master-1-of-3', status: 'complete'},
                {gh_job_name: 'e2e-on-ubuntu-latest-master-2-of-3', status: 'complete'},
                {gh_job_name: 'e2e-on-ubuntu-latest-master-3-of-3', status: 'complete'},
                {gh_job_name: 'e2e-on-windows-2022-master-1-of-3', status: 'complete'},
            ],
            test_stats: {failed: 1, passed: 300, skipped: 8, total: 309},
        };
        const perJobCounts = {
            'e2e-on-ubuntu-latest-master-1-of-3': {passed: 80, failed: 0, skipped: 2, flaky: 0},
            'e2e-on-ubuntu-latest-master-2-of-3': {passed: 78, failed: 0, skipped: 1, flaky: 0},
            'e2e-on-ubuntu-latest-master-3-of-3': {passed: 81, failed: 0, skipped: 2, flaky: 0},
            'e2e-on-windows-2022-master-1-of-3': {passed: 90, failed: 1, skipped: 3, flaky: 0},
        };
        const byKey = buildOsStatusTotals({detail, perJobCounts});
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            readyWhenOs: 'linux',
            overallState: 'failure',
            byKey,
            upstreamJobsSucceeded: true,
            minReports: 3,
            detail,
            perJobCounts,
            hasPerJobCounts: true,
            overallFailed: 1,
        }), false);
        assert.equal(statusFromTotals(
            byKey.linux,
            true,
            'E2E incomplete — no results for this OS',
            {
                minReports: 3,
                uploadedReports: 3,
                hasPerJobCounts: true,
                hasCountsForEveryUploadedReport: true,
                overallFailed: 1,
            },
        ).state, 'success');
        assert.equal(shouldFailFromScope({
            failOnTestFailures: true,
            readyWhenOs: 'windows',
            overallState: 'failure',
            byKey,
            upstreamJobsSucceeded: true,
            minReports: 1,
            detail,
            perJobCounts,
            hasPerJobCounts: true,
            overallFailed: 1,
        }), true);
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

