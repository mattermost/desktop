// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/tsio-report-status.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    buildOsStatusTotals,
    flipPerOsCommitStatuses,
    reportUrlForStatusBucket,
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
