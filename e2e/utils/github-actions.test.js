// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/github-actions.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    canonicalizeOs,
    osFromCmtJobName,
    parseCmtMatrixJobName,
    listCmtMatrixJobResults,
    formatCmtJobsChannelMessage,
    summarizeCmtJobsByOs,
    cmtOsCommitStatus,
    playwrightProjectForOs,
} = require('./github-actions');

describe('canonicalizeOs', () => {
    it('keeps linux|macos|windows', () => {
        assert.equal(canonicalizeOs('linux'), 'linux');
        assert.equal(canonicalizeOs('macos'), 'macos');
        assert.equal(canonicalizeOs('windows'), 'windows');
    });

    it('derives OS from runner labels', () => {
        assert.equal(canonicalizeOs('', 'ubuntu-latest'), 'linux');
        assert.equal(canonicalizeOs(undefined, 'macos-26'), 'macos');
        assert.equal(canonicalizeOs('darwin', 'windows-2022'), 'windows');
    });

    it('returns null when neither platform nor runner is recognized', () => {
        assert.equal(canonicalizeOs('freebsd', 'custom-runner'), null);
    });
});

describe('osFromCmtJobName', () => {
    it('parses CMT job names of the form os-version', () => {
        assert.equal(osFromCmtJobName('linux-11.9.0'), 'linux');
        assert.equal(osFromCmtJobName('macos-11.8.4'), 'macos');
        assert.equal(osFromCmtJobName('windows-10.5.14'), 'windows');
    });

    it('ignores unrelated jobs', () => {
        assert.equal(osFromCmtJobName('calculate-commit-hash'), null);
        assert.equal(osFromCmtJobName(''), null);
    });
});

describe('summarizeCmtJobsByOs', () => {
    it('marks an OS failed when any matrix cell failed', () => {
        const byOs = summarizeCmtJobsByOs([
            {name: 'linux-11.9.0', conclusion: 'success'},
            {name: 'linux-11.8.4', conclusion: 'failure'},
            {name: 'macos-11.9.0', conclusion: 'success'},
            {name: 'calculate-commit-hash', conclusion: 'success'},
        ], ['linux', 'macos', 'windows']);

        assert.deepEqual(byOs.linux, {failed: true, seen: true});
        assert.deepEqual(byOs.macos, {failed: false, seen: true});
        assert.deepEqual(byOs.windows, {failed: false, seen: false});
    });
});

describe('cmtOsCommitStatus', () => {
    it('fails incomplete OS buckets', () => {
        assert.deepEqual(
            cmtOsCommitStatus({failed: false, seen: false}, 'windows'),
            {state: 'failure', description: 'E2E incomplete — no windows CMT jobs'},
        );
    });

    it('fails when any matrix cell failed', () => {
        assert.deepEqual(
            cmtOsCommitStatus({failed: true, seen: true}, 'linux'),
            {state: 'failure', description: 'E2E failed on linux'},
        );
    });

    it('succeeds when every seen cell passed', () => {
        assert.deepEqual(
            cmtOsCommitStatus({failed: false, seen: true}, 'macos'),
            {state: 'success', description: 'E2E passed on macos'},
        );
    });
});

describe('playwrightProjectForOs', () => {
    it('maps canonical OS ids to Playwright project names', () => {
        assert.equal(playwrightProjectForOs('linux'), 'linux');
        assert.equal(playwrightProjectForOs('macos'), 'darwin');
        assert.equal(playwrightProjectForOs('windows'), 'win32');
        assert.equal(playwrightProjectForOs(null), 'linux');
    });
});

describe('parseCmtMatrixJobName', () => {
    it('parses os-version and reusable-workflow names', () => {
        assert.deepEqual(parseCmtMatrixJobName('linux-11.9.0'), {os: 'linux', serverVersion: '11.9.0'});
        assert.deepEqual(
            parseCmtMatrixJobName('macos-10.11.23 / e2e-on-macos-26'),
            {os: 'macos', serverVersion: '10.11.23'},
        );
        assert.deepEqual(
            parseCmtMatrixJobName('windows-11.11.0 / e2e-on-windows-2022'),
            {os: 'windows', serverVersion: '11.11.0'},
        );
    });

    it('ignores setup jobs', () => {
        assert.equal(parseCmtMatrixJobName('calculate-commit-hash'), null);
        assert.equal(parseCmtMatrixJobName('update-success-final-status'), null);
    });
});

describe('formatCmtJobsChannelMessage', () => {
    const jobs = [
        {name: 'linux-11.11.0 / e2e-on-ubuntu-latest', conclusion: 'success'},
        {name: 'windows-10.11.23 / e2e-on-windows-2022', conclusion: 'failure'},
        {name: 'macos-11.9.1 / e2e-on-macos-26', conclusion: 'success'},
        {name: 'calculate-commit-hash', conclusion: 'success'},
    ];

    it('lists matrix legs and marks overall failed when any job failed', () => {
        const text = formatCmtJobsChannelMessage({
            desktopVersion: 'v6.2.4-rc.1',
            sha: '4749f699f62e7d341a056ef6b3aa28a14f12baea',
            runUrl: 'https://github.com/mattermost/desktop/actions/runs/1',
            jobs,
        });
        assert.match(text, /^## ❌ Desktop CMT\n/);
        assert.match(text, /\*\*Branch:\*\* `v6\.2\.4-rc\.1` · \*\*Commit:\*\* `4749f69`/);
        assert.match(text, /🔴 \*\*1 failing job\*\*/);
        assert.match(text, /\| 🐧 Linux \| `11\.11\.0` \| ✅ \|/);
        assert.match(text, /\| 🪟 Windows \| `10\.11\.23` \| ❌ failure \|/);
        assert.match(text, /➡️ \*\*Workflow:\*\* https:\/\/github\.com\/mattermost\/desktop\/actions\/runs\/1/);
        assert.equal(listCmtMatrixJobResults(jobs).length, 3);
    });

    it('renders a passed banner when every matrix job succeeded', () => {
        const text = formatCmtJobsChannelMessage({
            desktopVersion: 'v6.2.4-rc.1',
            sha: 'abc1234',
            jobs: [
                {name: 'linux-11.11.0', conclusion: 'success'},
                {name: 'macos-11.11.0', conclusion: 'success'},
            ],
        });
        assert.match(text, /^## ✅ Desktop CMT\n/);
        assert.doesNotMatch(text, /failing job/);
    });
});
