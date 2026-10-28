// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/cmt-triage-verdict.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {foldCmtVerdicts, foldMasterTriage, formatCmtVerdictMessage} = require('./cmt-triage-verdict');

const repoRoot = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const identity = {repository: 'mattermost/desktop', commit_sha: 'a51f2e2deadbeef', branch: 'v6.2.5-rc.1', name: 'cmt-desktop', gh_run_id: '40460811152'};

const linuxLanes = ['10.11.25', '11.7.14', '11.11.3', '12.0.1', '12.1.0-rc2'].map((server) => ({platform: 'linux', server}));
const clearedLinux = linuxLanes.map(({server}) => ({platform: 'linux', serverVersion: server, verdict: 'SUCCESS', blocking: '0', exonerated: '3'}));

describe('foldCmtVerdicts', () => {
    it('is green (passed) when nothing failed and triage was not expected', () => {
        const fold = foldCmtVerdicts({lanes: [], expectedLanes: linuxLanes, expectTriage: false, stats: {passed: 812, failed: 0, skipped: 12}});
        assert.equal(fold.state, 'green');
        assert.equal(fold.kind, 'passed');
        assert.equal(fold.commitStatusState, 'success');
    });

    it('is green (flaky) when triage cleared every failing lane', () => {
        const fold = foldCmtVerdicts({lanes: clearedLinux, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        assert.equal(fold.state, 'green');
        assert.equal(fold.kind, 'flaky');
        assert.equal(fold.commitStatusState, 'success');
        assert.equal(fold.clearedLegs.length, 5);
        assert.equal(fold.clearedCount, 15);
    });

    it('is red only when a lane still blocks after triage', () => {
        const lanes = [...clearedLinux.slice(1), {platform: 'linux', serverVersion: '10.11.25', verdict: 'FAILURE', blocking: '2', exonerated: '1'}];
        const fold = foldCmtVerdicts({lanes, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        assert.equal(fold.state, 'red');
        assert.equal(fold.commitStatusState, 'failure');
        assert.equal(fold.blockingLegs.length, 1);
        assert.equal(fold.blockingLegs[0].serverVersion, '10.11.25');
        assert.equal(fold.blockingCount, 2);
        assert.match(fold.statusDescription, /^2 blocking failures after triage — needs investigation · /);
    });

    it('treats ACTION_REQUIRED as yellow, never green and never red', () => {
        const lanes = [...clearedLinux.slice(1), {platform: 'linux', serverVersion: '10.11.25', verdict: 'ACTION_REQUIRED', blocking: '1', exonerated: '0'}];
        const fold = foldCmtVerdicts({lanes, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        assert.equal(fold.state, 'yellow');
        assert.equal(fold.commitStatusState, 'error');
        assert.equal(fold.unknownLegs.length, 1);
    });

    it('treats a missing lane verdict as unknown (yellow)', () => {
        const fold = foldCmtVerdicts({lanes: clearedLinux.slice(1), expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5}});
        assert.equal(fold.state, 'yellow');
        assert.equal(fold.unknownLegs.length, 1);
        assert.equal(fold.unknownLegs[0].reason, 'not triaged');
    });

    it('treats an empty verdict as unknown (yellow)', () => {
        const lanes = [...clearedLinux.slice(1), {platform: 'linux', serverVersion: '10.11.25', verdict: '', blocking: '', exonerated: ''}];
        const fold = foldCmtVerdicts({lanes, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5}});
        assert.equal(fold.state, 'yellow');
    });

    it('never goes green when failures exist but triage did not run', () => {
        const fold = foldCmtVerdicts({lanes: [], expectedLanes: linuxLanes, expectTriage: false, stats: {passed: 807, failed: 5}});
        assert.equal(fold.state, 'yellow');
        assert.equal(fold.commitStatusState, 'error');
    });

    it('never goes green when an upstream CI job failed outside tracked tests', () => {
        const fold = foldCmtVerdicts({lanes: [], expectedLanes: linuxLanes, expectTriage: false, upstreamJobsSucceeded: false, stats: {passed: 812, failed: 0}});
        assert.equal(fold.state, 'yellow');
    });

    it('never goes green when an upstream CI job failed, even if triage cleared every lane', () => {
        const fold = foldCmtVerdicts({lanes: clearedLinux, expectedLanes: linuxLanes, expectTriage: true, upstreamJobsSucceeded: false, stats: {passed: 807, failed: 5, skipped: 12}});
        assert.equal(fold.state, 'yellow');
        assert.equal(fold.commitStatusState, 'error');
    });

    it('still goes red when a lane blocks, even if an upstream CI job also failed', () => {
        const lanes = [...clearedLinux.slice(1), {platform: 'linux', serverVersion: '10.11.25', verdict: 'FAILURE', blocking: '2', exonerated: '1'}];
        const fold = foldCmtVerdicts({lanes, expectedLanes: linuxLanes, expectTriage: true, upstreamJobsSucceeded: false, stats: {passed: 807, failed: 5, skipped: 12}});
        assert.equal(fold.state, 'red');
        assert.equal(fold.commitStatusState, 'failure');
    });

    it('is yellow when triage was expected but the matrix produced no lanes', () => {
        const fold = foldCmtVerdicts({lanes: [], expectedLanes: [], expectTriage: true, stats: {passed: 0, failed: 5}});
        assert.equal(fold.state, 'yellow');
    });
});

describe('foldMasterTriage', () => {
    const leg = (os, extra = {}) => ({os, kind: 'e2e', serverVersion: 'master', status: 'failed', failed: 2, ...extra});
    const lane = (platform, verdict, extra = {}) => ({platform, verdict, blocking: '0', exonerated: '2', ...extra});

    it('clears when every failing OS lane was cleared by triage', () => {
        const fold = foldMasterTriage({lanes: [lane('linux', 'SUCCESS')], legs: [leg('linux')], overallFailed: true});
        assert.equal(fold.verdict, 'cleared');
        assert.equal(fold.clearedLegs.length, 1);
    });

    it('blocks when a lane still blocks after triage', () => {
        const fold = foldMasterTriage({lanes: [lane('linux', 'FAILURE', {blocking: '2'})], legs: [leg('linux')], overallFailed: true});
        assert.equal(fold.verdict, 'blocking');
        assert.equal(fold.blockingLegs.length, 1);
    });

    it('is inconclusive for ACTION_REQUIRED, missing lanes, and untriaged OSes', () => {
        assert.equal(foldMasterTriage({lanes: [lane('linux', 'ACTION_REQUIRED')], legs: [leg('linux')], overallFailed: true}).verdict, 'inconclusive');
        assert.equal(foldMasterTriage({lanes: [], legs: [leg('linux')], overallFailed: true}).verdict, 'inconclusive');
        assert.equal(foldMasterTriage({lanes: [lane('linux', '')], legs: [leg('linux')], overallFailed: true}).verdict, 'inconclusive');
    });

    it('never clears policy legs or missing legs (triage does not judge them)', () => {
        const policy = foldMasterTriage({lanes: [lane('macos', 'SUCCESS')], legs: [leg('macos', {kind: 'policy', serverVersion: 'policy'})], overallFailed: true});
        assert.equal(policy.verdict, 'inconclusive');
        const missing = foldMasterTriage({lanes: [lane('linux', 'SUCCESS')], legs: [leg('linux')], missingLegs: [leg('macos', {status: 'missing', failed: 0})], overallFailed: true});
        assert.equal(missing.verdict, 'inconclusive');
    });

    it('cannot clear an upstream CI failure with no failing test, nor a run with no legs', () => {
        assert.equal(foldMasterTriage({lanes: [lane('linux', 'SUCCESS')], legs: [], upstreamJobsSucceeded: false, overallFailed: true}).verdict, 'inconclusive');
        assert.equal(foldMasterTriage({lanes: [], legs: [], overallFailed: true, noLegs: true}).verdict, 'inconclusive');
        assert.equal(foldMasterTriage({lanes: [], legs: [], overallFailed: false}).verdict, 'cleared');
    });

    it('is inconclusive when a failed run has no leg triage positively cleared', () => {
        assert.equal(foldMasterTriage({lanes: [lane('linux', 'SUCCESS')], legs: [], overallFailed: true}).verdict, 'inconclusive');
        assert.equal(foldMasterTriage({lanes: [lane('linux', 'SUCCESS')], legs: [leg('linux', {status: 'missing', failed: 0})], overallFailed: true}).verdict, 'inconclusive');
    });
});

describe('formatCmtVerdictMessage', () => {
    const links = {reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/v6.2.5-rc.1/a51f2e2/cmt-desktop', runUrl: 'https://github.com/mattermost/desktop/actions/runs/40460811152'};

    it('renders the flaky-green message short, with no per-leg table', () => {
        const fold = foldCmtVerdicts({lanes: clearedLinux, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {passed: 807, failed: 5, skipped: 12}, ...links});
        assert.match(text, /:green_circle: \*\*Desktop CMT — flaky, no bug found\*\*/);
        assert.match(text, /Branch: `v6\.2\.5-rc\.1` · Commit: `a51f2e2`/);
        assert.match(text, /AI triage cleared every failing leg \(5 legs, 15 cleared by triage: flaky \/ failed in master \/ Infra failure\)/);
        assert.ok(!(/exonerated|broken on trunk/).test(text), 'uses the existing triage wording, no new jargon');
        assert.match(text, /\*\*807 passed\*\* · 5 failed · 12 skipped/);
        assert.match(text, /➡️ \[Full report\]\(https:\/\/test-io/);
        assert.ok(!text.includes('| Platform'), 'no per-leg table');
        assert.ok(text.trimEnd().split('\n').length <= 7, 'stays short');
    });

    it('renders the red message naming only the blocking legs', () => {
        const lanes = [...clearedLinux.slice(1), {platform: 'linux', serverVersion: '10.11.25', verdict: 'FAILURE', blocking: '2', exonerated: '1'}];
        const fold = foldCmtVerdicts({lanes, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {passed: 807, failed: 5, skipped: 12}, ...links});
        assert.match(text, /:red_circle: \*\*Desktop CMT — needs investigation\*\*/);
        assert.match(text, /Blocking after triage: 🐧 Linux Server `10\.11\.25` — 2 blocking/);
        assert.ok(!text.includes('likely bug'), 'a held failure is not called a bug: triage cannot tell one on a release build');
        assert.ok(!text.includes('11.7.14'), 'cleared legs are not listed');
    });

    it('renders ACTION_REQUIRED as needs-investigation, not as a bug', () => {
        const lanes = [...clearedLinux.slice(1), {platform: 'linux', serverVersion: '10.11.25', verdict: 'ACTION_REQUIRED', blocking: '1', exonerated: '0'}];
        const fold = foldCmtVerdicts({lanes, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {passed: 807, failed: 5, skipped: 12}, ...links});
        assert.match(text, /:yellow_circle: \*\*Desktop CMT — needs investigation\*\*/);
        assert.match(text, /could not settle/);
        assert.ok(!text.includes('likely bug'));
    });

    it('renders a clean run as a short green pass', () => {
        const fold = foldCmtVerdicts({lanes: [], expectedLanes: linuxLanes, expectTriage: false, stats: {passed: 812, failed: 0, skipped: 12}});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {passed: 812, failed: 0, skipped: 12}, ...links});
        assert.match(text, /:green_circle: \*\*Desktop CMT — passed\*\*/);
        assert.ok(text.trimEnd().split('\n').length <= 5, 'stays short');
    });
});

describe('CMT triage wiring', () => {
    // Workflow files check out with CRLF on Windows CI; normalize before
    // matching multi-line regexes.
    const readLf = (rel) => read(rel).replace(/\r\n/g, '\n');

    it('exposes the toolkit verdict from the e2e-triage composite action', () => {
        const action = readLf('.github/actions/e2e-triage/action.yml');
        assert.match(action, / {2}verdict:\n {4}description:.*\n {4}value: \$\{\{ steps\.triage\.outputs\.verdict \}\}/);
        assert.match(action, / {2}blocking:/);
        assert.match(action, / {2}exonerated:/);
        assert.match(action, /^ {6}id: triage$/m);

        // Defaults preserve the PR/master caller behavior.
        assert.match(action, /report-name: \$\{\{ inputs\.report-name \|\| format\('e2e-on-\{0\}', inputs\.runner\) \}\}/);
        assert.match(action, /status-context: \$\{\{ inputs\.status-context \|\| format\('e2e\/\{0\}', inputs\.platform\) \}\}/);
    });

    it('runs per-server triage lanes and a verdict job in the CMT workflow', () => {
        const workflow = readLf('.github/workflows/compatibility-matrix-testing.yml');
        assert.match(workflow, /^ {2}cmt-triage:$/m);
        assert.match(workflow, /^ {2}cmt-verdict:$/m);
        assert.match(workflow, /report-name: e2e-on-/);
        assert.match(workflow, /status-context: e2e\/compatibility-matrix-testing/);
        assert.match(workflow, /triage-status-context: 'off'/);
        assert.match(workflow, /mode: report-only/);
        assert.match(workflow, /cmt-triage-verdict-/);
    });

    it('suppresses the old verbose notification; only the verdict job posts', () => {
        const workflow = readLf('.github/workflows/compatibility-matrix-testing.yml');
        assert.match(workflow, /notifyChannel: false/);
    });
});
