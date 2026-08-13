// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/tsio-report-status.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    buildOsStatusTotals,
    flipPerOsCommitStatuses,
} = require('./tsio-report-status');

describe('buildOsStatusTotals', () => {
    it('groups per-job counts and shard failures by OS', () => {
        const byOs = buildOsStatusTotals({
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

        assert.deepEqual(byOs.linux, {
            passed: 101,
            failed: 0,
            skipped: 5,
            shardFailed: false,
            hasResults: true,
        });
        assert.deepEqual(byOs.windows, {
            passed: 90,
            failed: 2,
            skipped: 5,
            shardFailed: true,
            hasResults: true,
        });
        assert.deepEqual(byOs.macos, {
            passed: 9,
            failed: 0,
            skipped: 0,
            shardFailed: false,
            hasResults: true,
        });
    });

    it('marks an OS with no counts but a failed shard', () => {
        const byOs = buildOsStatusTotals({
            detail: {
                reports: [
                    {gh_job_name: 'e2e-on-macos-26-11.10.0', status: 'failed'},
                ],
            },
            perJobCounts: {},
        });

        assert.equal(byOs.macos.shardFailed, true);
        assert.equal(byOs.macos.hasResults, false);
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
});
