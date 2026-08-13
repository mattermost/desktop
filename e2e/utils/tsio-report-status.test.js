// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/tsio-report-status.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {buildOsStatusTotals} = require('./tsio-report-status');

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
