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

    it('never clears a lane on incomplete results, even one triage called SUCCESS', () => {
        const lanes = [...clearedLinux.slice(1), {platform: 'linux', serverVersion: '10.11.25', verdict: 'SUCCESS', blocking: '0', exonerated: '3', description: '(3 flaky; results incomplete: 4 of 5 reports) 99.6% passed'}];
        const fold = foldCmtVerdicts({lanes, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        assert.equal(fold.state, 'yellow');
        assert.equal(fold.clearedLegs.length, 4);
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {passed: 807, failed: 5, skipped: 12}});
        assert.match(text, /^⚠️ Results incomplete on 1 lane — re-run$/m);
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

    it('renders the flaky-green message in three lines', () => {
        const fold = foldCmtVerdicts({lanes: clearedLinux, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {passed: 807, failed: 5, skipped: 12}, ...links});
        assert.equal(text, [
            ':green_circle: **Desktop CMT** `v6.2.5-rc.1` — no bugs',
            '✅ **Not bugs:** 15 failures cleared by triage',
            '807 passed · 5 failed · 12 skipped · [Report](https://test-io.test.mattermost.com/reports/desktop/v6.2.5-rc.1/a51f2e2/cmt-desktop) · [Run](https://github.com/mattermost/desktop/actions/runs/40460811152)',
            '',
        ].join('\n'));
    });

    it('renders a red lane that names no test by the lane alone', () => {
        const lanes = [...clearedLinux.slice(1), {platform: 'linux', serverVersion: '10.11.25', verdict: 'FAILURE', blocking: '2', exonerated: '1'}];
        const fold = foldCmtVerdicts({lanes, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {passed: 807, failed: 5, skipped: 12}, ...links});
        assert.match(text, /^:red_circle: \*\*Desktop CMT\*\* `v6\.2\.5-rc\.1` — 1 lane still red$/m);
        assert.match(text, /^⚠️ Red, no test named: 🐧 Linux 10\.11\.25$/m);
        assert.ok(!text.includes('likely bug'), 'a held failure is not called a bug: triage cannot tell one on a release build');
        assert.ok(!text.includes('11.7.14'), 'cleared legs are not listed');
    });

    it('renders ACTION_REQUIRED as "couldn\'t tell", not as a bug', () => {
        const lanes = [...clearedLinux.slice(1), {platform: 'linux', serverVersion: '10.11.25', verdict: 'ACTION_REQUIRED', blocking: '1', exonerated: '0'}];
        const fold = foldCmtVerdicts({lanes, expectedLanes: linuxLanes, expectTriage: true, stats: {passed: 807, failed: 5, skipped: 12}});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {passed: 807, failed: 5, skipped: 12}, ...links});
        assert.match(text, /^:yellow_circle: \*\*Desktop CMT\*\* `v6\.2\.5-rc\.1` — couldn't tell$/m);
        assert.match(text, /^⚠️ Couldn't settle: 🐧 Linux 10\.11\.25$/m);
        assert.ok(!text.includes('likely bug'));
    });

    it('renders a clean run as a two-line green pass', () => {
        const fold = foldCmtVerdicts({lanes: [], expectedLanes: linuxLanes, expectTriage: false, stats: {passed: 812, failed: 0, skipped: 12}});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {passed: 812, failed: 0, skipped: 12}, ...links});
        assert.match(text, /^:green_circle: \*\*Desktop CMT\*\* `v6\.2\.5-rc\.1` — passed$/m);
        assert.equal(text.trimEnd().split('\n').length, 2);
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

describe('per-test CMT message', () => {
    // v6.3.2-rc.2, run 40651298431: each test's failing lanes, labels and explanations, from the lanes' triage logs.
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
        return {platform: leg.platform, serverVersion: leg.server, verdict: blocking ? 'FAILURE' : 'SUCCESS', blocking: String(blocking), exonerated: String(findings.length - blocking), findings, findingsRecorded: true};
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

    it('says in four lines which tests to check and which are not bugs, never "likely bug"', () => {
        const fold = foldCmtVerdicts({lanes, expectedLanes: matrix, expectTriage: true, stats});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: {...identity, branch: 'v6.3.2-rc.2'}, stats, ...links});
        assert.equal(text, [
            ':red_circle: **Desktop CMT** `v6.3.2-rc.2` — 1 test to check',
            '🔎 **Check:** `MM-T2633` needs investigation, 6/15 lanes',
            '✅ **Not bugs:** `MM-T5890` server compat · `MM-T5611` server compat · `MM-T4054` test bug',
            '3323 passed · 26 failed · 306 skipped · [Report](https://test-io.test.mattermost.com/reports/desktop/v6.3.2-rc.2/725fbc7/cmt-desktop) · [Run](https://github.com/mattermost/desktop/actions/runs/40651298431)',
            '',
        ].join('\n'));
        assert.match(fold.statusDescription, /^1 test needs a look · 3323 passed, 26 failed, 306 skipped$/, 'the status counts tests, not lanes');
    });

    it('counts a test that failed on Windows and elsewhere once, whatever the path separator', () => {
        const windows = (f) => ({...f, file: f.file.replace(/\//g, '\\'), full_title: `${f.file.replace(/^e2e\/specs\//, '').replace(/\//g, '\\')} > ${f.title}`});
        const mixed = lanes.map((l) => (l.platform === 'windows' ? {...l, findings: l.findings.map(windows)} : {...l, findings: l.findings.map((f) => ({...f, full_title: `${f.file.replace(/^e2e\/specs\//, '')} > ${f.title}`}))}));
        const fold = foldCmtVerdicts({lanes: mixed, expectedLanes: matrix, expectTriage: true, stats});
        assert.deepEqual(fold.tests.map((t) => [t.title.slice(0, 8), t.lanes]), [['MM-T2633', 6], ['MM-T5890', 3], ['MM-T5611', 2], ['MM-T4054', 15]]);
    });

    it('calls a run with an app bug "likely app bug", and one with nothing held "no bugs"', () => {
        const appBugLane = (l) => ({...l, verdict: 'FAILURE', blocking: '1', findings: [{...T4054, label: 'app bug', blocking: true, explanation: 'The preview modal never opens.'}]});
        const appBug = lanes.map((l) => (l.platform === 'linux' && l.serverVersion === '11.11.3' ? appBugLane(l) : l));
        const redFold = foldCmtVerdicts({lanes: appBug, expectedLanes: matrix, expectTriage: true, stats});
        const red = formatCmtVerdictMessage({fold: redFold, compositeIdentity: identity, stats, ...links});
        assert.match(red, /^:red_circle: \*\*Desktop CMT\*\* `v6\.2\.5-rc\.1` — 1 likely app bug, 1 test to check$/m);
        assert.match(red, /^🐞 \*\*App bug:\*\* `MM-T4054` 15\/15 lanes$/m, 'the most severe label any lane gave it');
        assert.match(redFold.statusDescription, /^1 likely app bug · /);
        const cleared = lanes.map((l) => ({...l, verdict: 'SUCCESS', blocking: '0', findings: l.findings.filter((f) => !f.blocking)}));
        const green = formatCmtVerdictMessage({fold: foldCmtVerdicts({lanes: cleared, expectedLanes: matrix, expectTriage: true, stats}), compositeIdentity: identity, stats, ...links});
        assert.match(green, /^:green_circle: \*\*Desktop CMT\*\* `v6\.2\.5-rc\.1` — no bugs$/m);
        assert.match(green, /^✅ \*\*Not bugs:\*\* `MM-T5890` server compat · `MM-T5611` server compat · `MM-T4054` test bug$/m);
    });

    it('tells apart two tests of one file that share a leaf title, by their full titles', () => {
        const leaf = (suite) => ({...T4054, full_title: `${suite} ${T4054.title}`});
        const twoSuites = [{platform: 'linux', serverVersion: '10.11.25', verdict: 'SUCCESS', findingsRecorded: true, findings: [leaf('Desktop'), leaf('Web')]}];
        const fold = foldCmtVerdicts({lanes: twoSuites, expectedLanes: [{platform: 'linux', server: '10.11.25'}], expectTriage: true, stats});
        assert.deepEqual(fold.tests.map((t) => t.lanes), [1, 1], 'two tests in one lane, not one test in two lanes');
    });

    it('names a blocking lane whose tests could not be read, beside the tests of the others', () => {
        const partial = lanes.map((l) => (l.platform === 'windows' && l.serverVersion === '12.0.1' ? {...l, findings: [], findingsRecorded: false} : l));
        const text = formatCmtVerdictMessage({fold: foldCmtVerdicts({lanes: partial, expectedLanes: matrix, expectTriage: true, stats}), compositeIdentity: identity, stats, ...links});
        assert.match(text, /^🔎 \*\*Check:\*\* `MM-T2633` needs investigation, 5\/15 lanes$/m);
        assert.match(text, /^⚠️ Red, no test named: 🪟 Windows 12\.0\.1$/m);
        assert.match(foldCmtVerdicts({lanes: partial, expectedLanes: matrix, expectTriage: true, stats}).statusDescription, /^1 test needs a look; 1 lane red, no test named · /);
    });

    it('names a lane red only for a shard that never reported, which has no blocking test', () => {
        const shard = lanes.map((l) => (l.platform === 'linux' && l.serverVersion === '10.11.25' ? {...l, verdict: 'FAILURE', blocking: '0'} : l));
        const text = formatCmtVerdictMessage({fold: foldCmtVerdicts({lanes: shard, expectedLanes: matrix, expectTriage: true, stats}), compositeIdentity: identity, stats, ...links});
        assert.match(text, /^⚠️ Red, no test named: 🐧 Linux 10\.11\.25$/m);
    });

    it('says a lane red only for incomplete results needs a re-run, not that it is blocking', () => {
        const incomplete = (l) => ({...l, verdict: 'FAILURE', blocking: '0', findings: l.findings.filter((f) => !f.blocking), description: '(1 test bug; results incomplete: 15 of 15 reports) 99.6% passed'});
        const onlyIncomplete = lanes.map((l) => (l.serverVersion.startsWith('12.') ? l : incomplete(l)));
        const fold = foldCmtVerdicts({lanes: onlyIncomplete, expectedLanes: matrix, expectTriage: true, stats});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats, ...links});
        assert.match(text, /^⚠️ Results incomplete on 9 lanes — re-run$/m);
        assert.ok(!text.includes('no test named'));
        assert.match(fold.statusDescription, /^1 test needs a look; results incomplete · /);

        // v6.3.2-rc.2: every lane was incomplete, the six that held MM-T2633 too.
        const all = lanes.map((l) => ({...l, description: '(results incomplete: 15 of 15 reports) 99.1% passed'}));
        const allText = formatCmtVerdictMessage({fold: foldCmtVerdicts({lanes: all, expectedLanes: matrix, expectTriage: true, stats}), compositeIdentity: identity, stats, ...links});
        assert.match(allText, /^🔎 \*\*Check:\*\* `MM-T2633` needs investigation, 6\/15 lanes$/m);
        assert.match(allText, /^⚠️ Results incomplete on 15 lanes — re-run$/m, 'a lane that names a held test, or that triage cleared, still needs a re-run');
        const noneHeld = lanes.map(incomplete);
        const red = formatCmtVerdictMessage({fold: foldCmtVerdicts({lanes: noneHeld, expectedLanes: matrix, expectTriage: true, stats}), compositeIdentity: identity, stats, ...links});
        assert.match(red, /^:red_circle: \*\*Desktop CMT\*\* `v6\.2\.5-rc\.1` — results incomplete, re-run$/m);
    });

    it('keeps each explanation with the label it was given for', () => {
        const mixed = [
            {platform: 'linux', serverVersion: '10.11.25', verdict: 'SUCCESS', findings: [{...T4054, explanation: 'A test bug.'}]},
            {platform: 'macos', serverVersion: '10.11.25', verdict: 'FAILURE', blocking: '1', findings: [{...T4054, label: 'needs investigation', blocking: true, explanation: null}]},
        ];
        const fold = foldCmtVerdicts({lanes: mixed, expectedLanes: [{platform: 'linux', server: '10.11.25'}, {platform: 'macos', server: '10.11.25'}], expectTriage: true, stats});
        assert.deepEqual([fold.tests[0].label, fold.tests[0].explanation], ['needs investigation', null], 'not the test-bug explanation under a needs-investigation label');
    });

    it('keeps the tests of a lane triage could not settle out of the blocking list, and names the lane', () => {
        const unsettled = lanes.map((l) => (l.platform === 'macos' && l.serverVersion === '11.7.14' ? {...l, verdict: 'ACTION_REQUIRED', findings: [{...T5611, label: 'needs investigation', blocking: true}]} : l));
        const fold = foldCmtVerdicts({lanes: unsettled, expectedLanes: matrix, expectTriage: true, stats});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats, ...links});
        assert.ok(!fold.tests.some((t) => t.title === T5611.title && t.blocking), 'the unsettled lane adds no blocking test');
        assert.match(text, /^⚠️ Couldn't settle: 🍎 macOS 11\.7\.14$/m);
        const short = unsettled.map((l) => (l.platform === 'macos' && l.serverVersion === '11.7.14' ? {...l, description: '(results incomplete: 14 of 15 reports)'} : l));
        const rerun = formatCmtVerdictMessage({fold: foldCmtVerdicts({lanes: short, expectedLanes: matrix, expectTriage: true, stats}), compositeIdentity: identity, stats, ...links});
        assert.match(rerun, /^⚠️ Results incomplete on 1 lane — re-run$/m, 'an unsettled lane with incomplete results needs a re-run too');
        assert.ok(!rerun.includes("Couldn't settle"));
    });

    it('names two tests of one file with the same leaf title by their full titles', () => {
        const suite = (name) => ({...T2633, full_title: `${name} ${T2633.title}`});
        const twin = [{platform: 'linux', serverVersion: '12.0.1', verdict: 'FAILURE', blocking: '2', findingsRecorded: true, findings: [suite('Login'), suite('SSO')]}];
        const fold = foldCmtVerdicts({lanes: twin, expectedLanes: [{platform: 'linux', server: '12.0.1'}], expectTriage: true, stats});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats, ...links});
        assert.match(text, /`Login MM-T2633 back button/);
        assert.match(text, /`SSO MM-T2633 back button/);
    });

    it('spells out names that would read alike when shortened', () => {
        const checkLine = (findings) => {
            const one = [{platform: 'linux', serverVersion: '12.0.1', verdict: 'FAILURE', blocking: String(findings.length), findingsRecorded: true, findings}];
            const fold = foldCmtVerdicts({lanes: one, expectedLanes: [{platform: 'linux', server: '12.0.1'}], expectTriage: true, stats});
            return formatCmtVerdictMessage({fold, compositeIdentity: identity, stats, ...links}).split('\n').find((l) => l.startsWith('🔎'));
        };
        const long = (file, end) => ({title: `Opening a channel from the sidebar keeps the ${end}`, file, label: 'needs investigation', blocking: true});
        const longs = checkLine([long('e2e/specs/a.test.ts', 'draft'), long('e2e/specs/b.test.ts', 'scroll position')]);
        assert.match(longs, /`Opening a channel from the sidebar keeps the draft`/);
        assert.match(longs, /`Opening a channel from the sidebar keeps the scroll position`/);
        const sameId = (file) => ({...T2633, file, full_title: `${file.split('/').pop()} > ${T2633.title}`});
        const ids = checkLine([sameId('e2e/specs/login/a.test.ts'), sameId('e2e/specs/login/b.test.ts')]);
        assert.match(ids, /`a\.test\.ts > MM-T2633 back button returns to login after mock SSO navigation`/);
        assert.match(ids, /`b\.test\.ts > MM-T2633 back button returns to login after mock SSO navigation`/);
    });

    it('never names a test bug for a run whose jobs died before any test ran (run 40648275037)', () => {
        const fold = foldCmtVerdicts({lanes: [], expectedLanes: matrix, expectTriage: true, stats: {}, upstreamJobsSucceeded: false});
        const text = formatCmtVerdictMessage({fold, compositeIdentity: identity, stats: {}, ...links});
        assert.notEqual(fold.state, 'green');
        assert.deepEqual(fold.tests, []);
        assert.ok(!(/test bug|app bug|likely bug/).test(text));
    });
});
