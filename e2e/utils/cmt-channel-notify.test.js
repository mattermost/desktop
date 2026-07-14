// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    parseCmtJobName,
    resolveWebhookUrl,
    buildLegSummaries,
    formatCmtChannelMessage,
} = require('./cmt-channel-notify');

describe('cmt-channel-notify', () => {
    describe('parseCmtJobName', () => {
        it('parses ubuntu, windows, and macos job names', () => {
            assert.deepEqual(parseCmtJobName('e2e-on-ubuntu-latest-11.9.0'), {
                os: 'linux',
                serverVersion: '11.9.0',
                runner: 'ubuntu-latest',
                kind: 'e2e',
            });
            assert.deepEqual(parseCmtJobName('e2e-on-windows-2022-10.5.14'), {
                os: 'windows',
                serverVersion: '10.5.14',
                runner: 'windows-2022',
                kind: 'e2e',
            });
            assert.deepEqual(parseCmtJobName('e2e-on-macos-13-11.8.3-rc.1'), {
                os: 'macos',
                serverVersion: '11.8.3-rc.1',
                runner: 'macos-13',
                kind: 'e2e',
            });
        });

        it('parses policy-tests job names', () => {
            assert.deepEqual(parseCmtJobName('policy-tests-macos'), {
                os: 'macos',
                serverVersion: 'policy',
                runner: 'macos',
                kind: 'policy',
            });
            assert.deepEqual(parseCmtJobName('policy-tests-windows'), {
                os: 'windows',
                serverVersion: 'policy',
                runner: 'windows',
                kind: 'policy',
            });
        });

        it('returns null for unexpected names', () => {
            assert.equal(parseCmtJobName('linux-11.9.0'), null);
            assert.equal(parseCmtJobName(''), null);
        });
    });

    describe('resolveWebhookUrl', () => {
        const env = {
            MATTERMOST_CMT_WEBHOOK_URL: 'https://mm.example/hooks/cmt',
            MATTERMOST_E2E_WEBHOOK_URL: 'https://mm.example/hooks/e2e',
            MATTERMOST_WEBHOOK_URL: 'https://mm.example/hooks/fallback',
        };

        it('sends CMT and master to the CMT webhook', () => {
            assert.equal(resolveWebhookUrl('cmt-desktop', env), env.MATTERMOST_CMT_WEBHOOK_URL);
            assert.equal(resolveWebhookUrl('desktop-master', env), env.MATTERMOST_CMT_WEBHOOK_URL);
        });

        it('sends PR runs to the E2E webhook', () => {
            assert.equal(resolveWebhookUrl('desktop-pr', env), env.MATTERMOST_E2E_WEBHOOK_URL);
        });

        it('does not fall back master to the PR webhook when CMT secret is missing', () => {
            assert.equal(
                resolveWebhookUrl('desktop-master', {MATTERMOST_E2E_WEBHOOK_URL: env.MATTERMOST_E2E_WEBHOOK_URL}),
                '',
            );
        });
    });

    describe('formatCmtChannelMessage', () => {
        it('renders per-leg passed/failed lines', () => {
            const text = formatCmtChannelMessage({
                compositeIdentity: {
                    branch: 'v6.2.0-rc.1',
                    commit_sha: '55afc0b839545804ee156fe95b4c1ac05c9d0cdc',
                    name: 'cmt-desktop',
                },
                detail: {
                    status: 'completed',
                    test_stats: {passed: 460, failed: 1, skipped: 40, total: 501},
                    reports: [
                        {id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-11.9.0', status: 'complete'},
                        {id: 'rid-windows', gh_job_name: 'e2e-on-windows-2022-11.9.0', status: 'complete'},
                    ],
                },
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/v6.2.0-rc.1/55afc0b/cmt-desktop',
                baseUrl: 'https://test-io.test.mattermost.com',
                perJobCounts: {
                    'e2e-on-ubuntu-latest-11.9.0': {passed: 231, failed: 0, skipped: 20, flaky: 0},
                    'e2e-on-windows-2022-11.9.0': {passed: 230, failed: 1, skipped: 20, flaky: 0},
                },
                upstreamJobsSucceeded: true,
            });

            assert.match(text, /Desktop CMT — `v6\.2\.0-rc\.1` @ `55afc0b`/);
            assert.match(text, /:x: \*\*Overall:\*\* failed/);
            assert.match(text, /\[full report\]\(https:\/\/test-io\.test\.mattermost\.com\/reports\/desktop\/v6\.2\.0-rc\.1\/55afc0b\/cmt-desktop\)/);
            assert.match(text, /\*\*Linux\*\*/);
            assert.match(text, /\*\*Windows\*\*/);
            assert.match(text, /- Server version `11\.9\.0`: :white_check_mark: All 231 passed · \[view report\]\(https:\/\/test-io\.test\.mattermost\.com\/reports\/r\/rid-linux\)/);
            assert.match(text, /- Server version `11\.9\.0`: :x: 230 passed, 1 failed · \[view report\]\(https:\/\/test-io\.test\.mattermost\.com\/reports\/r\/rid-windows\)/);
        });

        it('uses Desktop PR E2E title for desktop-pr reports', () => {
            const text = formatCmtChannelMessage({
                compositeIdentity: {
                    branch: 'pr-3891',
                    commit_sha: '55afc0b839545804ee156fe95b4c1ac05c9d0cdc',
                    name: 'desktop-pr',
                },
                detail: {
                    status: 'completed',
                    test_stats: {passed: 240, failed: 0, skipped: 10, total: 250},
                    reports: [],
                },
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/pr-3891/55afc0b/desktop-pr',
                baseUrl: 'https://test-io.test.mattermost.com',
                perJobCounts: {},
                upstreamJobsSucceeded: true,
            });
            assert.match(text, /Desktop PR E2E — `pr-3891` @ `55afc0b`/);
            assert.match(text, /:white_check_mark: \*\*Overall:\*\* passed/);
        });
    });

    describe('buildLegSummaries', () => {
        it('sorts by server version then OS', () => {
            const rows = buildLegSummaries(
                {
                    'e2e-on-windows-2022-10.5.14': {passed: 1, failed: 0, skipped: 0, flaky: 0},
                    'e2e-on-ubuntu-latest-11.9.0': {passed: 1, failed: 0, skipped: 0, flaky: 0},
                    'e2e-on-ubuntu-latest-10.5.14': {passed: 1, failed: 0, skipped: 0, flaky: 0},
                },
                [],
            );
            assert.deepEqual(rows.map((r) => r.label), [
                '10.5.14-linux',
                '10.5.14-windows',
                '11.9.0-linux',
            ]);
        });
    });
});
