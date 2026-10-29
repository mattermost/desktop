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
    sanitizeInlineText,
    shouldPostToChannel,
    notifyCmtChannel,
    collapseSpecAttempts,
    resolveChannelTotals,
} = require('./cmt-channel-notify');

describe('cmt-channel-notify', () => {
    describe('collapseSpecAttempts', () => {
        it('counts a double-failed retry as one failure', () => {
            assert.equal(
                collapseSpecAttempts([{status: 'failed'}, {status: 'failed'}]),
                'failed',
            );
        });

        it('treats failed-then-passed as flaky', () => {
            assert.equal(
                collapseSpecAttempts([{status: 'failed'}, {status: 'passed'}]),
                'flaky',
            );
        });

        it('keeps explicit flaky and single pass/skip', () => {
            assert.equal(collapseSpecAttempts([{status: 'flaky'}]), 'flaky');
            assert.equal(collapseSpecAttempts([{status: 'passed'}]), 'passed');
            assert.equal(collapseSpecAttempts([{status: 'skipped'}]), 'skipped');
            assert.equal(collapseSpecAttempts([]), null);
        });
    });

    describe('resolveChannelTotals', () => {
        it('sums unique per-leg counts and folds flaky into passed', () => {
            assert.deepEqual(
                resolveChannelTotals({
                    'e2e-on-ubuntu-latest-11.9.0': {passed: 218, failed: 1, skipped: 11, flaky: 0},
                    'e2e-on-windows-2022-10.11.23': {passed: 214, failed: 2, skipped: 34, flaky: 1},
                }),
                {passed: 433, failed: 3, skipped: 45},
            );
        });

        it('falls back to test_stats when per-leg counts are empty', () => {
            assert.deepEqual(
                resolveChannelTotals({}, {passed: 200, failed: 14, skipped: 5, flaky: 3}),
                {passed: 203, failed: 14, skipped: 5},
            );
        });

        it('falls back to aggregate stats when an expected leg is missing from per-job counts', () => {
            assert.deepEqual(
                resolveChannelTotals(
                    {
                        'e2e-on-ubuntu-latest-11.9.0': {passed: 218, failed: 0, skipped: 11, flaky: 0},
                    },
                    {passed: 400, failed: 5, skipped: 20, flaky: 0},
                    [
                        'e2e-on-ubuntu-latest-11.9.0',
                        'e2e-on-windows-2022-11.9.0',
                    ],
                ),
                {passed: 400, failed: 5, skipped: 20},
            );
        });
    });

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

        // PR and master runs dispatch MM_SERVER_VERSION as a branch ref, not semver.
        // These used to return null, which silently dropped the leg from the per-OS
        // rollup and left e2e/<os> reporting "E2E incomplete — no results for this OS".
        it('parses job names whose server version is a branch ref, not semver', () => {
            assert.deepEqual(parseCmtJobName('e2e-on-ubuntu-latest-master'), {
                os: 'linux',
                serverVersion: 'master',
                runner: 'ubuntu-latest',
                kind: 'e2e',
            });
            assert.deepEqual(parseCmtJobName('e2e-on-macos-26-master'), {
                os: 'macos',
                serverVersion: 'master',
                runner: 'macos-26',
                kind: 'e2e',
            });
            assert.deepEqual(parseCmtJobName('e2e-on-windows-2022-master'), {
                os: 'windows',
                serverVersion: 'master',
                runner: 'windows-2022',
                kind: 'e2e',
            });
            assert.deepEqual(parseCmtJobName('e2e-on-ubuntu-22.04-release-11.9'), {
                os: 'linux',
                serverVersion: 'release-11.9',
                runner: 'ubuntu-22.04',
                kind: 'e2e',
            });
        });

        // Splitting on the version shape instead of the runner would read this as
        // runner `ubuntu-latest-release` + version `11.9.0`.
        it('keeps a hyphenated version out of the runner capture', () => {
            assert.deepEqual(parseCmtJobName('e2e-on-ubuntu-latest-release-11.9.0'), {
                os: 'linux',
                serverVersion: 'release-11.9.0',
                runner: 'ubuntu-latest',
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

        it('parses Playwright shard suffixes without folding them into the runner or version', () => {
            assert.deepEqual(parseCmtJobName('e2e-on-ubuntu-latest-master-1-of-3'), {
                os: 'linux',
                serverVersion: 'master',
                runner: 'ubuntu-latest',
                kind: 'e2e',
                shard: '1-of-3',
            });
            assert.deepEqual(parseCmtJobName('e2e-on-macos-26-release-11.9.0-2-of-2'), {
                os: 'macos',
                serverVersion: 'release-11.9.0',
                runner: 'macos-26',
                kind: 'e2e',
                shard: '2-of-2',
            });
            assert.deepEqual(parseCmtJobName('e2e-on-windows-2022-12.0.0-rc1-1-of-3'), {
                os: 'windows',
                serverVersion: '12.0.0-rc1',
                runner: 'windows-2022',
                kind: 'e2e',
                shard: '1-of-3',
            });
        });

        it('keeps unsharded CMT names without a shard field, including rc versions', () => {
            assert.equal(parseCmtJobName('e2e-on-ubuntu-latest-9.6.1').shard, undefined);
            const macRc = parseCmtJobName('e2e-on-macos-26-11.9.0-rc.3');
            assert.equal(macRc.serverVersion, '11.9.0-rc.3');
            assert.equal(macRc.shard, undefined);
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

            // Overall totals come from unique per-leg counts (not inflated TSIO test_stats).
            assert.match(text, /\| ❌ Failed \| \*\*461\*\* \| \*\*1\*\* \| \*\*40\*\* \|/);
            assert.match(text, /#### Detailed results/);
            assert.doesNotMatch(text, /<details>/);
            assert.match(text, /\| 🐧 Linux \| Server `11\.9\.0` \| ✅ 231\/231 \| \[View\]\(https:\/\/test-io\.test\.mattermost\.com\/reports\/r\/rid-linux\) \|/);
            assert.match(text, /\| 🪟 Windows \| Server `11\.9\.0` \| ❌ 230\/231 \| \[View\]\(https:\/\/test-io\.test\.mattermost\.com\/reports\/r\/rid-windows\) \|/);
            assert.match(text, /➡️ \*\*Full report:\*\* https:\/\/test-io\.test\.mattermost\.com\/reports\/desktop\/v6\.2\.0-rc\.1\/55afc0b\/cmt-desktop/);
        });

        it('prefers unique per-leg failed counts over inflated TSIO attempt totals', () => {
            const text = formatCmtChannelMessage({
                compositeIdentity: {
                    branch: 'master',
                    commit_sha: '5eda917312db037975bac5c3535272c61a664674',
                    name: 'cmt-desktop',
                },
                detail: {
                    status: 'completed',

                    // Inflated: each retry attempt counted (e.g. 1 unique fail × 2 attempts).
                    test_stats: {passed: 218, failed: 2, skipped: 11, total: 231},
                    reports: [
                        {id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-11.9.1', status: 'complete'},
                    ],
                },
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/5eda917/cmt-desktop',
                baseUrl: 'https://test-io.test.mattermost.com',
                perJobCounts: {

                    // Unique Playwright-style count after collapsing retries.
                    'e2e-on-ubuntu-latest-11.9.1': {passed: 218, failed: 1, skipped: 11, flaky: 0},
                },
                upstreamJobsSucceeded: true,
            });

            assert.match(text, /🔴 \*\*1 failing test\*\*/);
            assert.match(text, /\| 🐧 Linux \| Server `11\.9\.1` \| 1 \|/);
            assert.match(text, /\| ❌ Failed \| \*\*218\*\* \| \*\*1\*\* \| \*\*11\*\* \|/);
            assert.match(text, /\| 🐧 Linux \| Server `11\.9\.1` \| ❌ 218\/219 \|/);
            assert.doesNotMatch(text, /🔴 \*\*2 failing tests\*\*/);
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
            assert.match(text, /^:red_circle: \*\*Desktop Master E2E — failure on `master`\*\*\n/);
            assert.match(text, /\*\*0 failed\*\* · 100 passed · 0 skipped/);
            assert.match(text, /TSIO reported failed shard\(s\) not reflected in the test totals/);
            assert.doesNotMatch(text, /Detailed results/);
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

            // Unique per-leg sum: 216+220+237+9 = 682 passed, 30 skipped (not TSIO test_stats 674/51).
            assert.match(text, /\| ✅ Passed \| \*\*682\*\* \| \*\*0\*\* \| \*\*30\*\* \|/);
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
            assert.match(text, /^:red_circle: \*\*Desktop Master E2E — failure on `master`\*\*\n/);
            assert.match(text, /TSIO status: `incomplete`/);
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
                    reports: [
                        {id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-12.1.0-rc1', status: 'complete'},
                    ],
                },
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                baseUrl: 'https://test-io.test.mattermost.com',
                perJobCounts: {
                    'e2e-on-ubuntu-latest-12.1.0-rc1': {passed: 200, failed: 0, skipped: 5, flaky: 3},
                },
                upstreamJobsSucceeded: true,
            });
            assert.match(text, /^:white_check_mark: \*\*Desktop Master E2E\*\* — passed on `master` @ `a1b2c3d` \(203 passed, 5 skipped\)/);
            assert.doesNotMatch(text, /Detailed results/);
        });
    });

    describe('desktop-master short failure alerts', () => {
        const masterFailure = (extra = {}) => formatCmtChannelMessage({
            compositeIdentity: {
                repository: 'mattermost/desktop',
                branch: 'master',
                commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                name: 'desktop-master',
                gh_run_id: '123456',
            },
            detail: {
                status: 'completed',
                test_stats: {passed: 752, failed: 1, skipped: 42, total: 795},
                reports: [
                    {id: 'rid-linux-1', gh_job_name: 'e2e-on-ubuntu-latest-12.1.0-rc1-1-of-3', status: 'complete'},
                    {id: 'rid-linux-2', gh_job_name: 'e2e-on-ubuntu-latest-12.1.0-rc1-2-of-3', status: 'complete'},
                ],
            },
            reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
            baseUrl: 'https://test-io.test.mattermost.com',
            perJobCounts: {
                'e2e-on-ubuntu-latest-12.1.0-rc1-1-of-3': {passed: 70, failed: 1, skipped: 2, flaky: 0},
                'e2e-on-ubuntu-latest-12.1.0-rc1-2-of-3': {passed: 71, failed: 0, skipped: 2, flaky: 0},
            },
            upstreamJobsSucceeded: true,
            mergedPr: {number: 3916, title: 'Fix the thing', url: 'https://github.com/mattermost/desktop/pull/3916', author: 'dev'},
            ...extra,
        });

        it('is short, names master, the merged PR, and the failing suite', () => {
            const text = masterFailure();
            assert.match(text, /^:red_circle: \*\*Desktop Master E2E — failure on `master`\*\*$/m);
            assert.match(text, /After merge of \[#3916 Fix the thing\]\(https:\/\/github\.com\/mattermost\/desktop\/pull\/3916\) by @\u200bdev · commit `a1b2c3d`/);
            assert.match(text, /Failing: 🐧 Linux Server `12\.1\.0-rc1` — 1 failed \(\[report\]\(https:\/\/test-io\.test\.mattermost\.com\/reports\/r\/rid-linux-1\)\)/);
            assert.match(text, /\[Workflow run\]\(https:\/\/github\.com\/mattermost\/desktop\/actions\/runs\/123456\)/);
            assert.doesNotMatch(text, /Detailed results|\| Overall \|/);
            assert.ok(text.trimEnd().split('\n').length <= 10, text);
        });

        it('falls back to the head commit, then to the SHA alone, without a merged PR', () => {
            const withCommit = masterFailure({mergedPr: null, headCommit: {subject: 'Fix the thing (#3916)', author: 'dev'}});
            assert.match(withCommit, /After commit `a1b2c3d` by @\u200bdev — Fix the thing \\\(#3916\\\)/);
            const bare = masterFailure({mergedPr: null, headCommit: null});
            assert.match(bare, /On `master` · commit `a1b2c3d`/);
        });

        it('escapes Markdown and defuses mentions in PR titles and commit subjects', () => {
            assert.equal(
                sanitizeInlineText('Hi @channel [x](https://evil.example)'),
                'Hi @\u200bchannel \\[x\\]\\(https://evil.example\\)',
            );
            const text = masterFailure({mergedPr: {number: 3916, title: 'Ping @here ](https://evil.example)', author: 'dev'}});
            assert.doesNotMatch(text, /@here/);
            assert.doesNotMatch(text, /\]\(https:\/\/evil\.example\)/);
            assert.match(text, /After merge of \[#3916 Ping @\u200bhere \\\]\\\(https:\/\/evil\.example\\\)\]\(https:\/\/github\.com\/mattermost\/desktop\/pull\/3916\)/);
        });

        it('defuses mentions in PR-author and commit-author bylines', () => {
            const prText = masterFailure({mergedPr: {number: 3916, title: 'Fix the thing', author: 'channel'}});
            assert.doesNotMatch(prText, /by @channel/);
            assert.match(prText, /by @\u200bchannel · commit `a1b2c3d`/);

            const commitText = masterFailure({mergedPr: null, headCommit: {subject: 'Direct push', author: '@here'}});
            assert.doesNotMatch(commitText, /by @here/);
            assert.match(commitText, /by @\u200bhere — Direct push/);
        });

        it('posts only on failure (or missing legs) for master, always for other reports', () => {
            const oneLeg = {legs: [{}]};
            assert.equal(shouldPostToChannel({name: 'desktop-master'}, {overallFailed: false, missingLegs: [], ...oneLeg}), false);
            assert.equal(shouldPostToChannel({name: 'desktop-master'}, {overallFailed: true, missingLegs: [], ...oneLeg}), true);
            assert.equal(shouldPostToChannel({name: 'desktop-master'}, {overallFailed: false, missingLegs: [{}], ...oneLeg}), true);
            assert.equal(shouldPostToChannel({name: 'desktop-pr'}, {overallFailed: false, missingLegs: []}), true);
            assert.equal(shouldPostToChannel({name: 'cmt-desktop'}, {overallFailed: false, missingLegs: []}), true);

            // Triage-cleared master failures stay silent; unsettled ones post.
            assert.equal(shouldPostToChannel({name: 'desktop-master'}, {overallFailed: true, missingLegs: [], legs: [{}]}, 'cleared'), false);
            assert.equal(shouldPostToChannel({name: 'desktop-master'}, {overallFailed: true, missingLegs: [], legs: [{}]}, 'inconclusive'), true);
            assert.equal(shouldPostToChannel({name: 'desktop-master'}, {overallFailed: true, missingLegs: [], legs: [{}]}, 'blocking'), true);
        });

        it('alerts when a master run reports no legs, unless counts are unavailable', () => {
            assert.equal(shouldPostToChannel({name: 'desktop-master'}, {overallFailed: false, missingLegs: [], legs: []}), true);
            assert.equal(shouldPostToChannel({name: 'desktop-master'}, {overallFailed: false, missingLegs: [], legs: [], perJobCountsAvailable: false}), false);

            const text = formatCmtChannelMessage({
                compositeIdentity: {branch: 'master', commit_sha: 'a1b2c3d4', name: 'desktop-master'},
                detail: {status: 'completed', test_stats: {passed: 10, failed: 0, skipped: 1}, reports: []},
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                perJobCounts: {},
                upstreamJobsSucceeded: true,
            });
            assert.match(text, /^:red_circle: \*\*Desktop Master E2E — failure on `master`\*\*/);
            assert.match(text, /No per-leg results reported\./);
        });

        it('notifyCmtChannel suppresses a passed master run and posts a failed one', async () => {
            const originalFetch = global.fetch;
            const calls = [];
            let specStatus = 'passed';
            global.fetch = async (url) => {
                calls.push(String(url));
                const specs = [{
                    history: [{commit_sha: 'a1b2c3d4', run_attempt: '1', report_id: 'rid-linux', status: specStatus}],
                }];
                return {ok: true, text: async () => '', json: async () => ({specs})};
            };
            const core = {info: () => {}, warning: () => {}};
            const identity = {
                branch: 'master', commit_sha: 'a1b2c3d4', name: 'desktop-master', gh_run_id: '1', gh_run_attempt: '1',
            };
            const detail = (failed) => ({
                status: 'completed',
                test_stats: {passed: 10, failed, skipped: 1},
                reports: [{id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-12.1.0-rc1', status: 'complete'}],
            });
            const base = {
                core,
                baseUrl: 'https://test-io.test.mattermost.com',
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                webhookUrl: 'https://mm.example/hooks/master-health',
                compositeIdentity: identity,
            };
            try {
                await notifyCmtChannel({...base, detail: detail(0)});
                assert.ok(!calls.some((url) => url.includes('mm.example')), `passed master must not post, got ${calls}`);

                specStatus = 'failed';
                await notifyCmtChannel({...base, detail: detail(1), mergedPr: {number: 3916, title: 'Fix the thing', author: 'dev'}});
                assert.ok(calls.some((url) => url.includes('mm.example')), 'failed master must post');
            } finally {
                global.fetch = originalFetch;
            }
        });

        it('notifyCmtChannel does not invent missing legs when the per-leg count fetch fails', async () => {
            const originalFetch = global.fetch;
            const webhookBodies = [];
            global.fetch = async (url, options) => {
                if (String(url).includes('/api/v1/reports/consolidated')) {
                    throw new Error('consolidated unavailable');
                }
                webhookBodies.push(JSON.parse(options.body).text);
                return {ok: true, text: async () => '', json: async () => ({})};
            };
            const core = {info: () => {}, warning: () => {}};
            const base = {
                core,
                baseUrl: 'https://test-io.test.mattermost.com',
                reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                webhookUrl: 'https://mm.example/hooks/master-health',
                compositeIdentity: {
                    repository: 'mattermost/desktop',
                    branch: 'master',
                    commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                    name: 'desktop-master',
                    gh_run_id: '123456',
                },
            };
            const detail = (failed) => ({
                status: 'completed',
                test_stats: {passed: 10, failed, skipped: 1},
                reports: [{id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-12.1.0-rc1', status: 'complete'}],
            });
            try {
                await notifyCmtChannel({...base, detail: detail(0)});
                assert.equal(webhookBodies.length, 0, 'green master with unavailable counts must not post');

                await notifyCmtChannel({...base, detail: detail(1)});
                assert.equal(webhookBodies.length, 1, 'failed master must still post');
                assert.match(webhookBodies[0], /Per-leg counts unavailable/);
                assert.doesNotMatch(webhookBodies[0], /Missing\/empty/);
            } finally {
                global.fetch = originalFetch;
            }
        });

        describe('triage-driven master alerts', () => {
            const lanes = (verdict, extra = {}) => [{platform: 'linux', verdict, blocking: '0', exonerated: '1', ...extra}];

            it('renders green when triage cleared the failing legs', () => {
                const text = masterFailure({triageLanes: lanes('SUCCESS')});
                assert.match(text, /^:green_circle: \*\*Desktop Master E2E — flaky, no bug found\*\*/);
            });

            it('stays red when triage leaves blocking failures', () => {
                const text = masterFailure({triageLanes: lanes('FAILURE', {blocking: '1'})});
                assert.match(text, /^:red_circle: \*\*Desktop Master E2E — failure on `master`\*\*/);
            });

            it('renders yellow when triage could not settle a leg', () => {
                const text = masterFailure({triageLanes: lanes('ACTION_REQUIRED')});
                assert.match(text, /^:yellow_circle: \*\*Desktop Master E2E — needs investigation on `master`\*\*/);
                assert.match(text, /AI triage could not settle: 🐧 Linux \/ Server `12\.1\.0-rc1` — not counted as flaky or as a bug/);
                assert.ok(!(/exonerated|broken on trunk/).test(text), 'uses the existing triage wording, no new jargon');
            });

            it('calls a shard that uploaded complete but ran no tests a setup problem, not an unsettled failure', () => {
                // The 2026-10-29 master run: Linux shard 1-of-3 died in
                // globalSetup (Calls plugin did not disable), uploaded an
                // empty report, and every other leg passed. 0 failed overall.
                const text = formatCmtChannelMessage({
                    compositeIdentity: {
                        repository: 'mattermost/desktop',
                        branch: 'master',
                        commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                        name: 'desktop-master',
                        gh_run_id: '123456',
                    },
                    detail: {
                        status: 'completed',
                        test_stats: {passed: 672, failed: 0, skipped: 36, total: 708},
                        reports: [1, 2, 3].map((i) => ({
                            id: `rid-linux-${i}`,
                            gh_job_name: `e2e-on-ubuntu-latest-12.1.0-rc2-${i}-of-3`,
                            status: 'complete',
                        })),
                    },
                    reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                    baseUrl: 'https://test-io.test.mattermost.com',
                    perJobCounts: {
                        'e2e-on-ubuntu-latest-12.1.0-rc2-2-of-3': {passed: 80, failed: 0, skipped: 2, flaky: 0},
                        'e2e-on-ubuntu-latest-12.1.0-rc2-3-of-3': {passed: 77, failed: 0, skipped: 2, flaky: 0},
                    },
                    upstreamJobsSucceeded: true,
                    mergedPr: {number: 3916, title: 'Fix the thing', url: 'https://github.com/mattermost/desktop/pull/3916', author: 'dev'},
                    triageLanes: [],
                });
                assert.match(text, /^:yellow_circle: \*\*Desktop Master E2E — setup problem\*\*$/m);
                assert.match(text, /\*\*0 failed\*\* · 672 passed · 36 skipped/);
                assert.match(text, /⚙️ \*\*Setup:\*\* 🐧 Linux · Server `12\.1\.0-rc2` · 1 of 3 test groups ran no tests\. Not a product bug\./);
                assert.doesNotMatch(text, /could not settle|needs investigation/);
            });

            it('renders the setup message when triage is absent', () => {
                const text = formatCmtChannelMessage({
                    compositeIdentity: {
                        repository: 'mattermost/desktop',
                        branch: 'master',
                        commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                        name: 'desktop-master',
                        gh_run_id: '123456',
                    },
                    detail: {
                        status: 'completed',
                        test_stats: {passed: 157, failed: 0, skipped: 4, total: 161},
                        reports: [1, 2, 3].map((i) => ({
                            id: `rid-linux-${i}`,
                            gh_job_name: `e2e-on-ubuntu-latest-master-${i}-of-3`,
                            status: 'complete',
                        })),
                    },
                    reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                    baseUrl: 'https://test-io.test.mattermost.com',
                    perJobCounts: {
                        'e2e-on-ubuntu-latest-master-2-of-3': {passed: 80, failed: 0, skipped: 2, flaky: 0},
                        'e2e-on-ubuntu-latest-master-3-of-3': {passed: 77, failed: 0, skipped: 2, flaky: 0},
                    },
                    upstreamJobsSucceeded: true,
                });
                assert.match(text, /^:yellow_circle: \*\*Desktop Master E2E — setup problem\*\*$/m);
                assert.match(text, /⚙️ \*\*Setup:\*\* 🐧 Linux · Server `master` · 1 of 3 test groups ran no tests\. Not a product bug\./);
                assert.doesNotMatch(text, /:red_circle:|Missing\/empty:/);
            });

            it('does not call legs setup failures when per-leg counts are unavailable', () => {
                const text = formatCmtChannelMessage({
                    compositeIdentity: {
                        repository: 'mattermost/desktop',
                        branch: 'master',
                        commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                        name: 'desktop-master',
                        gh_run_id: '123456',
                    },
                    detail: {
                        status: 'completed',
                        test_stats: {passed: 10, failed: 0, skipped: 1, total: 11},
                        reports: [{id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-master', status: 'complete'}],
                    },
                    reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                    baseUrl: 'https://test-io.test.mattermost.com',
                    perJobCounts: {},
                    perJobCountsAvailable: false,
                    upstreamJobsSucceeded: false,
                });
                assert.match(text, /Per-leg counts unavailable/);
                assert.doesNotMatch(text, /Setup:|setup problem/);
            });

            it('names the legs triage did clear on a blocking run', () => {
                const text = formatCmtChannelMessage({
                    compositeIdentity: {
                        repository: 'mattermost/desktop',
                        branch: 'master',
                        commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                        name: 'desktop-master',
                        gh_run_id: '123456',
                    },
                    detail: {
                        status: 'completed',
                        test_stats: {passed: 100, failed: 3, skipped: 0, total: 103},
                        reports: [
                            {id: 'r-linux', gh_job_name: 'e2e-on-ubuntu-latest-master', status: 'complete'},
                            {id: 'r-macos', gh_job_name: 'e2e-on-macos-26-master', status: 'complete'},
                        ],
                    },
                    reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                    baseUrl: 'https://test-io.test.mattermost.com',
                    perJobCounts: {
                        'e2e-on-ubuntu-latest-master': {passed: 50, failed: 2, skipped: 0, flaky: 0},
                        'e2e-on-macos-26-master': {passed: 50, failed: 1, skipped: 0, flaky: 0},
                    },
                    upstreamJobsSucceeded: true,
                    triageLanes: [
                        {platform: 'linux', verdict: 'FAILURE', blocking: '2', exonerated: '0'},
                        {platform: 'macos', verdict: 'SUCCESS', blocking: '0', exonerated: '1'},
                    ],
                });
                assert.match(text, /^:red_circle:/);
                assert.match(text, /Failing: 🐧 Linux Server `master` — 2 failed/);
                assert.doesNotMatch(text, /🍎 macOS Server/, 'cleared legs are not listed as failing');
                assert.match(text, /AI triage cleared 1 failing leg \(flaky \/ failed in master \/ Infra failure\); the rest still block\./);
            });

            it('notifyCmtChannel stays silent when triage cleared the failure and posts yellow when inconclusive', async () => {
                const originalFetch = global.fetch;
                const webhookBodies = [];
                global.fetch = async (url, options) => {
                    if (String(url).includes('mm.example')) {
                        webhookBodies.push(JSON.parse(options.body).text);
                        return {ok: true, text: async () => '', json: async () => ({})};
                    }
                    const specs = [{
                        history: [{commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678', run_attempt: '1', report_id: 'rid-linux', status: 'failed'}],
                    }];
                    return {ok: true, text: async () => '', json: async () => ({specs})};
                };
                const core = {info: () => {}, warning: () => {}};
                const base = {
                    core,
                    baseUrl: 'https://test-io.test.mattermost.com',
                    reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/master/a1b2c3d/desktop-master',
                    webhookUrl: 'https://mm.example/hooks/master-health',
                    compositeIdentity: {
                        repository: 'mattermost/desktop',
                        branch: 'master',
                        commit_sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
                        name: 'desktop-master',
                        gh_run_id: '123456',
                        gh_run_attempt: '1',
                    },
                    detail: {
                        status: 'completed',
                        test_stats: {passed: 10, failed: 1, skipped: 1},
                        reports: [{id: 'rid-linux', gh_job_name: 'e2e-on-ubuntu-latest-12.1.0-rc1', status: 'complete'}],
                    },
                };
                try {
                    await notifyCmtChannel({...base, triageLanes: lanes('SUCCESS')});
                    assert.equal(webhookBodies.length, 0, 'triage-cleared master failure must not post');

                    await notifyCmtChannel({...base, triageLanes: lanes('ACTION_REQUIRED')});
                    assert.equal(webhookBodies.length, 1, 'inconclusive master failure must post');
                    assert.match(webhookBodies[0], /^:yellow_circle:/);
                } finally {
                    global.fetch = originalFetch;
                }
            });
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
