// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/cmt-channel-notify.test.js`.
// Not a Playwright Electron spec (no browser/app fixtures), so it stays under e2e/utils/.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    parseCmtJobName,
    resolveWebhookUrl,
    buildLegSummaries,
    formatLegResultText,
    formatCmtChannelMessage,
} = require('./cmt-channel-notify');

describe('cmt-channel-notify', () => {
    describe('formatLegResultText', () => {
        it('renders all-skipped legs as not executed instead of ✅ 0/0', () => {
            assert.equal(
                formatLegResultText({status: 'passed', passed: 0, failed: 0, skipped: 12}),
                '⚠️ not executed',
            );
        });

        it('preserves missing, no-results, passed, and failed formatting', () => {
            assert.equal(formatLegResultText({status: 'missing', passed: 0, failed: 0, skipped: 0}), '⚠️ missing');
            assert.equal(formatLegResultText({status: 'no-results', passed: 0, failed: 0, skipped: 0}), '⚠️ no-results');
            assert.equal(formatLegResultText({status: 'passed', passed: 231, failed: 0, skipped: 10}), '✅ 231/231');
            assert.equal(formatLegResultText({status: 'failed', passed: 229, failed: 2, skipped: 10}), '❌ 229/231');
        });
    });
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
            MATTERMOST_MASTER_HEALTH_WEBHOOK_URL: 'https://mm.example/hooks/master-health',
            MATTERMOST_WEBHOOK_URL: 'https://mm.example/hooks/fallback',
        };

        it('sends CMT to the release webhook', () => {
            assert.equal(resolveWebhookUrl('cmt-desktop', env), env.MATTERMOST_CMT_WEBHOOK_URL);
        });

        it('sends master runs to the master-health webhook', () => {
            assert.equal(resolveWebhookUrl('desktop-master', env), env.MATTERMOST_MASTER_HEALTH_WEBHOOK_URL);
        });

        it('sends PR runs to the E2E webhook', () => {
            assert.equal(resolveWebhookUrl('desktop-pr', env), env.MATTERMOST_E2E_WEBHOOK_URL);
        });

        it('does not fall back CMT to the E2E webhook when release secret is missing', () => {
            assert.equal(
                resolveWebhookUrl('cmt-desktop', {MATTERMOST_E2E_WEBHOOK_URL: env.MATTERMOST_E2E_WEBHOOK_URL}),
                '',
            );
        });

        it('does not use the shared webhook when a dedicated CMT secret is missing', () => {
            assert.equal(
                resolveWebhookUrl('cmt-desktop', {MATTERMOST_WEBHOOK_URL: env.MATTERMOST_WEBHOOK_URL}),
                '',
            );
        });

        it('does not use the shared or PR webhook when master-health secret is missing', () => {
            assert.equal(
                resolveWebhookUrl('desktop-master', {
                    MATTERMOST_WEBHOOK_URL: env.MATTERMOST_WEBHOOK_URL,
                    MATTERMOST_E2E_WEBHOOK_URL: env.MATTERMOST_E2E_WEBHOOK_URL,
                }),
                '',
            );
        });

        it('does not use the shared webhook when a dedicated E2E secret is missing for PR', () => {
            assert.equal(
                resolveWebhookUrl('desktop-pr', {MATTERMOST_WEBHOOK_URL: env.MATTERMOST_WEBHOOK_URL}),
                '',
            );
        });

        it('still uses the shared webhook for unknown report names', () => {
            assert.equal(resolveWebhookUrl('unknown-report', env), env.MATTERMOST_WEBHOOK_URL);
        });
    });

    describe('formatCmtChannelMessage', () => {
        it('renders failure banner, overall table, and per-leg details', () => {
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

            assert.match(text, /^## ❌ Desktop CMT\n/);
            assert.match(text, /\*\*Branch:\*\* `v6\.2\.0-rc\.1` · \*\*Commit:\*\* `55afc0b`/);
            assert.match(text, /🔴 \*\*1 failing test\*\*/);
            assert.match(text, /\| 🪟 Windows \| Server `11\.9\.0` \| 1 \|/);
            assert.match(text, /\| ❌ Failed \| \*\*460\*\* \| \*\*1\*\* \| \*\*40\*\* \|/);
            assert.match(text, /#### Detailed results/);
            assert.doesNotMatch(text, /<details>/);
            assert.match(text, /\| 🐧 Linux \| Server `11\.9\.0` \| ✅ 231\/231 \| \[View\]\(https:\/\/test-io\.test\.mattermost\.com\/reports\/r\/rid-linux\) \|/);
            assert.match(text, /\| 🪟 Windows \| Server `11\.9\.0` \| ❌ 230\/231 \| \[View\]\(https:\/\/test-io\.test\.mattermost\.com\/reports\/r\/rid-windows\) \|/);
            assert.match(text, /➡️ \*\*Full report:\*\* https:\/\/test-io\.test\.mattermost\.com\/reports\/desktop\/v6\.2\.0-rc\.1\/55afc0b\/cmt-desktop/);
        });

        it('renders a passed PR report with PR link and no failure banner', () => {
            const text = formatCmtChannelMessage({
                compositeIdentity: {
                    repository: 'mattermost/desktop',
                    branch: 'pr-3891',
                    commit_sha: '55afc0b839545804ee156fe95b4c1ac05c9d0cdc',
                    name: 'desktop-pr',
                    gh_pr_number: '3891',
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
            assert.match(text, /^## ✅ Desktop PR E2E\n/);
            assert.match(text, /\*\*PR:\*\* \[#3891\]\(https:\/\/github\.com\/mattermost\/desktop\/pull\/3891\)/);
            assert.doesNotMatch(text, /failing test/);
            assert.match(text, /\| ✅ Passed \| \*\*240\*\* \| \*\*0\*\* \| \*\*10\*\* \|/);
        });

        it('marks overall failed when hasFailures is set without test failures', () => {
            const text = formatCmtChannelMessage({
                compositeIdentity: {
                    branch: 'master',
                    commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                    name: 'desktop-master',
                },
                detail: {
                    status: 'completed',
                    test_stats: {passed: 100, failed: 0, skipped: 0, total: 100},
                    reports: [],
                },
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                baseUrl: 'https://test-io.test.mattermost.com',
                perJobCounts: {},
                upstreamJobsSucceeded: true,
                hasFailures: true,
            });
            assert.match(text, /^## ❌ Desktop Master E2E\n/);
            assert.match(text, /\| ❌ Failed \| \*\*100\*\* \| \*\*0\*\* \| \*\*0\*\* \|/);
            assert.match(text, /TSIO reported failed shard\(s\) not reflected in the test totals/);
            assert.doesNotMatch(text, /failing test/);
        });

        it('keeps overall passed when TSIO is still consolidating with 0 failures', () => {
            const text = formatCmtChannelMessage({
                compositeIdentity: {
                    repository: 'mattermost/desktop',
                    branch: 'pr-3916',
                    commit_sha: 'b41298f0abc1234567890abcdef1234567890abcd',
                    name: 'desktop-pr',
                    gh_pr_number: '3916',
                },
                detail: {
                    status: 'in_progress',
                    test_stats: {passed: 674, failed: 0, skipped: 51, total: 725},
                    reports: [
                        {id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-11.10.0-rc1', status: 'complete'},
                        {id: 'rid-mac', gh_job_name: 'e2e-on-macos-14-11.10.0-rc1', status: 'complete'},
                        {id: 'rid-win', gh_job_name: 'e2e-on-windows-2022-11.10.0-rc1', status: 'complete'},
                        {id: 'rid-win-policy', gh_job_name: 'policy-tests-windows', status: 'complete'},
                    ],
                },
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/pr-3916/b41298f/desktop-pr',
                baseUrl: 'https://test-io.test.mattermost.com',
                perJobCounts: {
                    'e2e-on-ubuntu-latest-11.10.0-rc1': {passed: 216, failed: 0, skipped: 10, flaky: 0},
                    'e2e-on-macos-14-11.10.0-rc1': {passed: 220, failed: 0, skipped: 10, flaky: 0},
                    'e2e-on-windows-2022-11.10.0-rc1': {passed: 237, failed: 0, skipped: 10, flaky: 0},
                    'policy-tests-windows': {passed: 9, failed: 0, skipped: 0, flaky: 0},
                    'policy-tests-macos': {passed: 0, failed: 0, skipped: 0, flaky: 0},
                },
                upstreamJobsSucceeded: true,
            });
            assert.match(text, /^## ✅ Desktop PR E2E\n/);
            assert.match(text, /\| ✅ Passed \| \*\*674\*\* \| \*\*0\*\* \| \*\*51\*\* \|/);
            assert.match(text, /TSIO report status: `in_progress` \(consolidation still catching up; not treated as a test failure\)/);
            assert.match(text, /Missing or empty leg report\(s\): 🍎 macOS \/ Policy/);
            assert.match(text, /\| 🍎 macOS \| Policy \| ⚠️ missing \|/);
            assert.doesNotMatch(text, /\| ❌ Failed \|/);
        });

        it('still marks overall failed for incomplete TSIO when tests failed', () => {
            const text = formatCmtChannelMessage({
                compositeIdentity: {
                    branch: 'master',
                    commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                    name: 'desktop-master',
                },
                detail: {
                    status: 'incomplete',
                    test_stats: {passed: 49, failed: 1, skipped: 0, total: 50},
                    reports: [],
                },
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                baseUrl: 'https://test-io.test.mattermost.com',
                perJobCounts: {},
                upstreamJobsSucceeded: true,
            });
            assert.match(text, /^## ❌ Desktop Master E2E\n/);
            assert.match(text, /TSIO report status: `incomplete`/);
        });

        it('folds test_stats.flaky into the headline passed count', () => {
            const text = formatCmtChannelMessage({
                compositeIdentity: {
                    branch: 'master',
                    commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                    name: 'desktop-master',
                },
                detail: {
                    status: 'completed',
                    test_stats: {passed: 200, failed: 0, skipped: 5, flaky: 3, total: 208},
                    reports: [],
                },
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                baseUrl: 'https://test-io.test.mattermost.com',
                perJobCounts: {},
                upstreamJobsSucceeded: true,
            });
            assert.match(text, /\| ✅ Passed \| \*\*203\*\* \| \*\*0\*\* \| \*\*5\*\* \|/);
        });
    });

    describe('buildLegSummaries', () => {
        it('sorts by OS then suite kind then server version', () => {
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
                '11.9.0-linux',
                '10.5.14-windows',
            ]);
        });
    });
});
