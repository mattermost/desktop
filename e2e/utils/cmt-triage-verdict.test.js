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

describe('per-test CMT message (toolkit findings file schema 2)', () => {
    // v6.3.2-rc.2, run 40651298431: which test failed on which of its 15 lanes, as the lanes' triage logs show. The labels
    // and explanations are what release triage gives them; MM-T2633's fix on master is in a helper, so it stays held.
    const servers = ['10.11.25', '11.7.14', '11.11.3', '12.0.1', '12.1.0-rc2'];
    const matrix = ['linux', 'macos', 'windows'].flatMap((platform) => servers.map((server) => ({platform, server})));
    const row = (title, file, label, blocking, explanation) => ({title, file, label, blocking, explanation});
    const T4054 = row('MM-T4054 Open/Close permanent link media preview', 'e2e/specs/mattermost/media_preview.test.ts', 'test bug', false, "The old test's PNG fixture is invalid; master replaced it.");
    const T2633 = row('MM-T2633 back button returns to login after mock SSO navigation', 'e2e/specs/login/sso_back_button.test.ts', 'needs investigation', true, null);
    const T5890 = row('MM-T5890 Opening channels in new windows', 'e2e/specs/multi_window/multi_window.test.ts', 'server compat', false, "10.11 has no 'Open in new window' item.");
    const T5611 = row('MM-T5611 Open a bookmark URL/link (External and Internal links)', 'e2e/specs/mattermost/bookmarks.test.ts', 'server compat', false, '10.11 has no Bookmarks Bar.');
    const failedOn = ({platform, server}) => [
        T4054,
        ...(server.startsWith('12.') ? [T2633] : []),
        ...(server === '10.11.25' ? [T5890] : []),
        ...(server === '10.11.25' && platform !== 'linux' ? [T5611] : []),
    ];
    const lanes = matrix.map((leg) => {
        const findings = failedOn(leg);
        const blocking = findings.filter((f) => f.blocking).length;
        return {platform: leg.platform, serverVersion: leg.server, verdict: blocking ? 'FAILURE' : 'SUCCESS', blocking: String(blocking), exonerated: String(findings.length - blocking), findings};
    });
    const stats = {passed: 3308, failed: 26, skipped: 306, flaky: 15};
    const links = {reportUrl: 'https://test-io.test.mattermost.com/reports/desktop/v6.3.2-rc.2/725fbc7/cmt-desktop', runUrl: 'https://github.com/mattermost/desktop/actions/runs/40651298431'};

    it('folds the 26 failures into 4 tests, most severe first, each with the lanes it failed in', () => {
        const fold = foldCmtVerdicts({lanes, expectedLanes: matrix, expectTriage: true, stats});
        assert.equal(fold.kind, 'blocking');
        assert.equal(lanes.reduce((n, l) => n + l.findings.length, 0), 26);
        assert.deepEqual(fold.tests.map((t) => [t.title.slice(0, 8), t.label, t.lanes, t.blocking]), [
            ['MM-T2633', 'needs investigation', 6, true],
            ['MM-T5890', 'server compat', 3, false],
            ['MM-T5611', 'server compat', 2, false],
            ['MM-T4054', 'test bug', 15, false],
        ]);
    });

    it('posts one line per held test and names what the rest are, never "likely bug"', () => {
        const fold = foldCmtVerdicts({lanes, expectedLanes: matrix, expectTriage: true, stats});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: {...identity, branch: 'v6.3.2-rc.2'}, stats, ...links});
        assert.match(text, /^:red_circle: \*\*Desktop CMT — needs investigation\*\*$/m);
        assert.match(text, /^• `MM-T2633` sso_back_button: needs investigation, failed in 6\/15 lanes$/m);
        assert.match(text, /^Not app bugs: `MM-T5890` \(server compat\); `MM-T5611` \(server compat\); `MM-T4054` \(test bug\)$/m);
        assert.ok(!text.includes('likely bug'));
        assert.ok(text.trimEnd().split('\n').length <= 8, 'stays short');
    });

    it('calls a run with an app bug "app bug likely", and one with nothing held "no app bug found"', () => {
        const appBug = lanes.map((l) => (l.platform === 'linux' && l.serverVersion === '11.11.3'
            ? {...l, verdict: 'FAILURE', blocking: '1', findings: [{...T4054, label: 'app bug', blocking: true, explanation: 'The preview modal never opens.'}]}
            : l));
        const red = formatCmtVerdictMessage({fold: foldCmtVerdicts({lanes: appBug, expectedLanes: matrix, expectTriage: true, stats}), compositeIdentity: identity, stats, ...links});
        assert.match(red, /^:red_circle: \*\*Desktop CMT — app bug likely\*\*$/m);
        assert.match(red, /^• `MM-T4054` media_preview: app bug, failed in 15\/15 lanes · The preview modal never opens\.$/m, 'the most severe label any lane gave it');
        const cleared = lanes.map((l) => ({...l, verdict: 'SUCCESS', blocking: '0', findings: l.findings.filter((f) => !f.blocking)}));
        const green = formatCmtVerdictMessage({fold: foldCmtVerdicts({lanes: cleared, expectedLanes: matrix, expectTriage: true, stats}), compositeIdentity: identity, stats, ...links});
        assert.match(green, /^:green_circle: \*\*Desktop CMT — no app bug found\*\*$/m);
        assert.match(green, /^• `MM-T4054` media_preview: test bug, failed in 15\/15 lanes · The old test's PNG fixture is invalid; master replaced it\.$/m);
    });

    it('keeps the per-lane message when the lanes carry no tests (a toolkit before findings file schema 2)', () => {
        const bare = lanes.map(({findings: _, ...l}) => l);
        const text = formatCmtVerdictMessage({fold: foldCmtVerdicts({lanes: bare, expectedLanes: matrix, expectTriage: true, stats}), compositeIdentity: identity, stats, ...links});
        assert.match(text, /^Blocking after triage: /m);
        assert.ok(!text.includes('•'));
    });

    it('never names a test bug for a run whose jobs died before any test ran (run 40648275037)', () => {
        const fold = foldCmtVerdicts({lanes: [], expectedLanes: matrix, expectTriage: true, stats: {}, upstreamJobsSucceeded: false});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {}, ...links});
        assert.notEqual(fold.state, 'green');
        assert.deepEqual(fold.tests, []);
        assert.ok(!/test bug|app bug|likely bug/.test(text));
    });
});
