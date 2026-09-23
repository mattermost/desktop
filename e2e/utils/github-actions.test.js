// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/github-actions.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    expandPlatformShards,
    totalReportsExpected,
    prepareE2eMatrix,
    E2E_PLAYWRIGHT_SHARDS,
} = require('./github-actions');

const threeOs = [
    {platform: 'linux', runner: 'ubuntu-latest', url: 'https://linux.example'},
    {platform: 'macos', runner: 'macos-26', url: 'https://macos.example'},
    {platform: 'windows', runner: 'windows-2022', url: 'https://windows.example'},
];

describe('E2E_PLAYWRIGHT_SHARDS', () => {
    it('shards linux×3, macos×2, windows×3', () => {
        assert.deepEqual(E2E_PLAYWRIGHT_SHARDS, {linux: 3, macos: 2, windows: 3});
    });
});

describe('expandPlatformShards', () => {
    it('expands each OS into i-of-n rows and keeps runner/url', () => {
        const rows = expandPlatformShards(threeOs);
        assert.equal(rows.length, 8);
        assert.deepEqual(rows.filter((r) => r.platform === 'linux').map((r) => r.shard), [
            '1-of-3',
            '2-of-3',
            '3-of-3',
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'linux').map((r) => r.shardDisplay), [
            '1/3',
            '2/3',
            '3/3',
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'macos').map((r) => r.shard), [
            '1-of-2',
            '2-of-2',
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'windows').map((r) => r.shard), [
            '1-of-3',
            '2-of-3',
            '3-of-3',
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'windows').map((r) => r.shardDisplay), [
            '1/3',
            '2/3',
            '3/3',
        ]);
        assert.ok(rows.every((r) => r.runner && r.url));
    });

    it('canonicalizes runner-only rows', () => {
        const rows = expandPlatformShards([{runner: 'ubuntu-24.04', url: 'https://x'}]);
        assert.equal(rows.length, 3);
        assert.ok(rows.every((r) => r.platform === 'linux'));
    });
});

describe('totalReportsExpected', () => {
    it('counts 8 shards + 2 policy = 10 for a full Matterwick PR matrix', () => {
        assert.equal(totalReportsExpected(threeOs), 10);
    });

    it('omits policy when asked', () => {
        assert.equal(totalReportsExpected(threeOs, {includePolicy: false}), 8);
    });

    it('must not be used for CMT totals (CMT is unsharded env × server, not these shard counts)', () => {
        // compatibility-matrix-testing.yml uses jq `(.environment|length)*(.server|length)`
        // and leaves template `shard` at 1-of-1. Feeding a 3-OS list into this helper
        // would inflate the TSIO group to 10. Keep that path off CMT.
        assert.equal(totalReportsExpected(threeOs), 10);
        assert.notEqual(3, totalReportsExpected(threeOs, {includePolicy: false}));
    });
});

describe('prepareE2eMatrix', () => {
    it('groups shards by OS and reports counts', () => {
        const matrix = prepareE2eMatrix(threeOs);
        assert.equal(matrix.linux.length, 3);
        assert.equal(matrix.macos.length, 2);
        assert.equal(matrix.windows.length, 3);
        assert.equal(matrix.linuxShardCount, 3);
        assert.equal(matrix.macosShardCount, 2);
        assert.equal(matrix.windowsShardCount, 3);
        assert.equal(matrix.totalReportsExpected, 10);
        assert.equal(matrix.linux[0].shard, '1-of-3');
        assert.equal(matrix.linux[0].shardDisplay, '1/3');
        assert.equal(matrix.windows[2].shard, '3-of-3');
    });

    it('leaves missing OS matrices empty', () => {
        const matrix = prepareE2eMatrix([{platform: 'linux', runner: 'ubuntu-latest'}]);
        assert.equal(matrix.linux.length, 3);
        assert.deepEqual(matrix.macos, []);
        assert.deepEqual(matrix.windows, []);
        assert.equal(matrix.totalReportsExpected, 5);
    });
});

describe('TSIO gh-job-name equals GHA job runtime name', () => {
    const workflowsDir = path.join(__dirname, '../../.github/workflows');

    it('nested template job name equals E2E_GH_JOB_NAME', () => {
        const yml = fs.readFileSync(path.join(workflowsDir, 'e2e-functional-template.yml'), 'utf8');
        const name = yml.match(/^[ ]{4}name: (e2e-on-.+)$/m);
        const env = yml.match(/E2E_GH_JOB_NAME: (e2e-on-.+)$/m);
        assert.ok(name, 'template job name must be e2e-on-…');
        assert.ok(env, 'E2E_GH_JOB_NAME must be e2e-on-…');
        assert.equal(name[1], env[1]);
        assert.match(name[1], /^e2e-on-\$\{\{ inputs\.runs-on \}\}/);
    });

    it('policy job name equals gh-job-name', () => {
        const yml = fs.readFileSync(path.join(workflowsDir, 'e2e-functional.yml'), 'utf8');
        const name = yml.match(/^[ ]{4}name: (policy-tests-\$\{\{ matrix\.platform \}\})$/m);
        const gh = yml.match(/gh-job-name: (policy-tests-\$\{\{ matrix\.platform \}\})$/m);
        assert.ok(name, 'policy job name must be policy-tests-<platform>');
        assert.ok(gh, 'policy gh-job-name must be policy-tests-<platform>');
        assert.equal(name[1], gh[1]);
    });

    it('caller job titles stay human-readable (TSIO matches the last / segment)', () => {
        const yml = fs.readFileSync(path.join(workflowsDir, 'e2e-functional.yml'), 'utf8');
        assert.match(yml, /name: E2E Linux \(\$\{\{ matrix\.shardDisplay \}\}\)/);
        assert.match(yml, /name: E2E macOS \(\$\{\{ matrix\.shardDisplay \}\}\)/);
        assert.match(yml, /name: E2E Windows \(\$\{\{ matrix\.shardDisplay \}\}\)/);
    });
});

describe('Post/TSIO skip cancelled workflow runs', () => {
    const yml = fs.readFileSync(path.join(__dirname, '../../.github/workflows/e2e-functional.yml'), 'utf8');

    // GitHub expressions are `${{ ... }}`; join so eslint does not treat them as template interpolation.
    const gha = (expr) => ['$', '{{ ', expr, ' }}'].join('');

    function jobIf(jobId, source = yml) {
        const lines = source.split(/\r?\n/);
        const header = `  ${jobId}:`;
        const start = lines.indexOf(header);
        assert.ok(start >= 0, `${jobId} must exist`);
        for (let i = start + 1; i < lines.length; i++) {
            if ((/^ {2}\S/).test(lines[i])) {
                break;
            }
            const match = lines[i].match(/^ {4}if: (.+)$/);
            if (match) {
                return match[1];
            }
        }
        assert.fail(`${jobId} must have an if:`);
        return '';
    }

    it('Post e2e/* and TSIO summary keep always() so a failed or timed-out shard still posts', () => {
        assert.match(jobIf('e2e-linux-status'), /always\(\)/);
        assert.match(jobIf('e2e-macos-status'), /always\(\)/);
        assert.match(jobIf('e2e-windows-status'), /always\(\)/);
        assert.match(jobIf('e2e-policy-status'), /always\(\)/);
        assert.match(jobIf('tsio-summary'), /always\(\)/);
    });

    it('Post e2e/* and TSIO summary skip when the workflow run is cancelled()', () => {
        assert.equal(
            jobIf('e2e-linux-status'),
            gha("always() && !cancelled() && needs.prepare-matrix.outputs.linux != '[]'"),
        );
        assert.equal(
            jobIf('e2e-macos-status'),
            gha("always() && !cancelled() && needs.prepare-matrix.outputs.macos != '[]'"),
        );
        assert.equal(
            jobIf('e2e-windows-status'),
            gha("always() && !cancelled() && needs.prepare-matrix.outputs.windows != '[]'"),
        );
        assert.equal(jobIf('e2e-policy-status'), gha('always() && !cancelled()'));
        assert.equal(jobIf('tsio-summary'), gha('always() && !cancelled()'));
    });

    it('concurrency keys master by SHA and only cancels in-progress PR runs', () => {
        assert.ok(yml.includes('group: e2e-functional-' + gha('inputs.pr_number || github.sha')));
        assert.ok(yml.includes('cancel-in-progress: ' + gha("inputs.pr_number != ''")));
    });

    it('parses job if: on CRLF checkouts (Windows CI)', () => {
        const crlf = yml.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
        assert.match(jobIf('e2e-linux-status', crlf), /always\(\)/);
        assert.equal(jobIf('tsio-summary', crlf), gha('always() && !cancelled()'));
    });
});

describe('e2e job timeout-minutes', () => {
    const workflowsDir = path.join(__dirname, '../../.github/workflows');
    const gha = (expr) => ['$', '{{ ', expr, ' }}'].join('');

    function jobTimeoutMinutes(file, jobId) {
        const source = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        const lines = source.split(/\r?\n/);
        const header = `  ${jobId}:`;
        const start = lines.indexOf(header);
        assert.ok(start >= 0, `${file} ${jobId} must exist`);
        for (let i = start + 1; i < lines.length; i++) {
            if ((/^ {2}\S/).test(lines[i])) {
                break;
            }
            const match = lines[i].match(/^ {4}timeout-minutes: (.+)$/);
            if (match) {
                return match[1];
            }
        }
        assert.fail(`${file} ${jobId} must have timeout-minutes`);
        return '';
    }

    it('template e2e is 30 for PR/master shards and 60 for unsharded CMT', () => {
        assert.equal(
            jobTimeoutMinutes('e2e-functional-template.yml', 'e2e'),
            gha('inputs.cmt && 60 || 30'),
        );
    });

    it('policy is 30; Post e2e/* and TSIO summary are 10', () => {
        assert.equal(jobTimeoutMinutes('e2e-functional.yml', 'e2e-policy-tests'), '30');
        assert.equal(jobTimeoutMinutes('e2e-functional.yml', 'e2e-linux-status'), '10');
        assert.equal(jobTimeoutMinutes('e2e-functional.yml', 'e2e-macos-status'), '10');
        assert.equal(jobTimeoutMinutes('e2e-functional.yml', 'e2e-windows-status'), '10');
        assert.equal(jobTimeoutMinutes('e2e-functional.yml', 'e2e-policy-status'), '10');
        assert.equal(jobTimeoutMinutes('e2e-functional.yml', 'tsio-summary'), '10');
    });

    it('CMT TSIO final-status is 10; CMT e2e legs pass cmt: true into the template', () => {
        assert.equal(jobTimeoutMinutes('compatibility-matrix-testing.yml', 'update-final-status'), '10');
        const cmt = fs.readFileSync(path.join(workflowsDir, 'compatibility-matrix-testing.yml'), 'utf8');
        assert.match(cmt, /^\s+cmt: true$/m);
    });
});

describe('e2e/policy node_modules cache key includes patches and arch', () => {
    const workflowsDir = path.join(__dirname, '../../.github/workflows');
    const v8Key = /build-node-modules-v8-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\(([^)]+)\) \}\}/g;
    const expectedHashArgs = "'**/package-lock.json', 'patches/**'";

    function v8NodeModulesHashArgs(file) {
        const yml = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        return [...yml.matchAll(v8Key)].map((m) => m[1]);
    }

    it('template restore and save hash package-lock.json and patches/** keyed by arch', () => {
        const args = v8NodeModulesHashArgs('e2e-functional-template.yml');
        assert.equal(args.length, 2, 'restore + save');
        assert.deepEqual(args, [expectedHashArgs, expectedHashArgs]);
    });

    it('policy jobs use the same restore and save key', () => {
        const args = v8NodeModulesHashArgs('e2e-functional.yml');
        assert.equal(args.length, 2, 'restore + save');
        assert.deepEqual(args, [expectedHashArgs, expectedHashArgs]);
    });

    it('ci.yaml and build-for-pr.yml do not share the e2e v8 key', () => {
        assert.deepEqual(v8NodeModulesHashArgs('ci.yaml'), []);
        assert.deepEqual(v8NodeModulesHashArgs('build-for-pr.yml'), []);
    });
});
