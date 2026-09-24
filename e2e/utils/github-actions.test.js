// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/github-actions.test.js`.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    expandPlatformShards,
    prepareE2eMatrix,
    E2E_PLAYWRIGHT_SHARDS,
} = require('./github-actions');

const repoRoot = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const workflow = (file) => read(`.github/workflows/${file}`);

// GitHub expressions are `${{ ... }}`; join so eslint does not treat them as template interpolation.
const gha = (expr) => ['$', '{{ ', expr, ' }}'].join('');

function jobLines(source, jobId) {
    const lines = source.split(/\r?\n/);
    const start = lines.indexOf(`  ${jobId}:`);
    assert.ok(start >= 0, `${jobId} must exist`);
    const end = lines.findIndex((line, i) => i > start && (/^ {2}\S/).test(line));
    return lines.slice(start, end === -1 ? lines.length : end);
}

function jobField(source, jobId, field) {
    for (const line of jobLines(source, jobId)) {
        const match = line.match(new RegExp(`^ {4}${field}: (.+)$`));
        if (match) {
            return match[1];
        }
    }
    return assert.fail(`${jobId} must have ${field}:`);
}

const threeOs = [
    {platform: 'linux', runner: 'ubuntu-latest', url: 'https://linux.example'},
    {platform: 'macos', runner: 'macos-26', url: 'https://macos.example'},
    {platform: 'windows', runner: 'windows-2022', url: 'https://windows.example'},
];

describe('expandPlatformShards / prepareE2eMatrix', () => {
    it('shards linux×3, macos×2, windows×3', () => {
        assert.deepEqual(E2E_PLAYWRIGHT_SHARDS, {linux: 3, macos: 2, windows: 3});
    });

    it('expands each OS into i-of-n rows and keeps runner/url', () => {
        const rows = expandPlatformShards(threeOs);
        assert.equal(rows.length, 8);
        assert.deepEqual(rows.filter((r) => r.platform === 'linux').map((r) => [r.shard, r.shardDisplay]), [
            ['1-of-3', '1/3'],
            ['2-of-3', '2/3'],
            ['3-of-3', '3/3'],
        ]);
        assert.deepEqual(rows.filter((r) => r.platform === 'macos').map((r) => r.shard), ['1-of-2', '2-of-2']);
        assert.ok(rows.every((r) => r.runner && r.url));
    });

    it('canonicalizes runner-only rows', () => {
        const rows = expandPlatformShards([{runner: 'ubuntu-24.04', url: 'https://x'}]);
        assert.equal(rows.length, 3);
        assert.ok(rows.every((r) => r.platform === 'linux'));
    });

    it('groups shards by OS and counts 8 shards + 2 policy reports', () => {
        const matrix = prepareE2eMatrix(threeOs);
        assert.equal(matrix.linuxShardCount, 3);
        assert.equal(matrix.macosShardCount, 2);
        assert.equal(matrix.windowsShardCount, 3);
        assert.equal(matrix.totalReportsExpected, 10);
        assert.equal(matrix.macosRunner, 'macos-26');
        assert.equal(matrix.windows[2].shard, '3-of-3');
    });

    it('leaves missing OS matrices empty', () => {
        const matrix = prepareE2eMatrix([{platform: 'linux', runner: 'ubuntu-latest'}]);
        assert.equal(matrix.linux.length, 3);
        assert.deepEqual(matrix.macos, []);
        assert.deepEqual(matrix.windows, []);
        assert.equal(matrix.totalReportsExpected, 5);
        assert.equal(matrix.linuxRunner, 'ubuntu-latest');
        assert.equal(matrix.macosRunner, '');
    });
});

describe('TSIO gh-job-name equals GHA job runtime name', () => {
    it('nested template job name equals E2E_GH_JOB_NAME', () => {
        const yml = workflow('e2e-functional-template.yml');
        const name = yml.match(/^[ ]{4}name: (e2e-on-.+)$/m);
        const env = yml.match(/E2E_GH_JOB_NAME: (e2e-on-.+)$/m);
        assert.ok(name && env);
        assert.equal(name[1], env[1]);
    });

    it('policy reusable workflow job name equals gh-job-name', () => {
        const yml = workflow('e2e-policy.yml');
        const name = yml.match(/^[ ]{4}name: (policy-tests-\$\{\{ inputs\.platform \}\})$/m);
        const gh = yml.match(/gh-job-name: (policy-tests-\$\{\{ inputs\.platform \}\})$/m);
        assert.ok(name && gh);
        assert.equal(name[1], gh[1]);
    });

    it('caller job titles stay human-readable (TSIO matches the last / segment)', () => {
        const yml = workflow('e2e-functional.yml');
        for (const os of ['Linux', 'macOS', 'Windows']) {
            assert.match(yml, new RegExp(`name: E2E ${os} \\(\\$\\{\\{ matrix\\.shardDisplay \\}\\}\\)`));
        }
    });
});

describe('e2e-functional.yml status jobs', () => {
    const yml = workflow('e2e-functional.yml');

    it('Post e2e/* and TSIO summary run on failed shards but skip cancelled runs', () => {
        for (const os of ['linux', 'macos', 'windows']) {
            assert.equal(
                jobField(yml, `e2e-${os}-status`, 'if'),
                gha(`always() && !cancelled() && needs.prepare-matrix.outputs.${os} != '[]'`),
            );
        }
        assert.equal(jobField(yml, 'e2e-policy-status', 'if'), gha('always() && !cancelled()'));
        assert.equal(jobField(yml, 'tsio-summary', 'if'), gha('always() && !cancelled()'));
    });

    it('concurrency keys master by SHA and only cancels in-progress PR runs', () => {
        assert.ok(yml.includes('group: e2e-functional-' + gha('inputs.pr_number || github.sha')));
        assert.ok(yml.includes('cancel-in-progress: ' + gha("inputs.pr_number != ''")));
    });

    it('parses job blocks on CRLF checkouts (Windows CI)', () => {
        const crlf = yml.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
        assert.equal(jobField(crlf, 'tsio-summary', 'if'), gha('always() && !cancelled()'));
        assert.equal(
            jobField(crlf, 'e2e-linux-status', 'if'),
            gha("always() && !cancelled() && needs.prepare-matrix.outputs.linux != '[]'"),
        );
        assert.doesNotMatch(crlf, /e2e-macos-install/);
    });

    it('pending-flips e2e/<os> and policy, then posts each from its own job', () => {
        for (const os of ['linux', 'macos', 'windows']) {
            assert.match(yml, new RegExp(`name: Post e2e/${os}\\r?\\n`));
        }
        assert.match(yml, /includePolicy: true/);
        assert.equal((yml.match(/perOsCommitStatuses: true/g) || []).length, 1);
        assert.match(yml, /perOsCommitStatuses: false/);
        const postOs = workflow('e2e-post-os-status.yml');
        assert.match(postOs, /perOsCommitStatuses: true/);
        assert.match(postOs, /readyWhenOs: process\.env\.READY_WHEN_OS/);
        assert.match(postOs, /notifyChannel: false/);
        assert.doesNotMatch(workflow('compatibility-matrix-testing.yml'), /e2e-post-os-status/);
    });

    it('shards and policy legs wait only on their own OS install job', () => {
        for (const os of ['linux', 'windows']) {
            const block = jobLines(yml, `e2e-${os}`).join('\n');
            assert.match(block, new RegExp(`- e2e-${os}-install`));
        }
        assert.doesNotMatch(yml, /e2e-macos-install/);
        assert.doesNotMatch(jobLines(yml, 'e2e-macos').join('\n'), /e2e-.*-install/);
        assert.doesNotMatch(jobLines(yml, 'e2e-policy-macos').join('\n'), /e2e-.*-install/);
        assert.match(jobLines(yml, 'e2e-policy-windows').join('\n'), /- e2e-windows-install/);
    });

    it('posts each OS status as soon as that OS finishes (separate needs, shared workflow)', () => {
        for (const os of ['linux', 'macos', 'windows']) {
            const block = jobLines(yml, `e2e-${os}-status`).join('\n');
            assert.match(block, new RegExp(`- e2e-${os}$`, 'm'));
            assert.match(block, /uses: \.\/\.github\/workflows\/e2e-post-os-status\.yml/);
            for (const other of ['linux', 'macos', 'windows'].filter((o) => o !== os)) {
                assert.doesNotMatch(block, new RegExp(`- e2e-${other}$`, 'm'));
            }
        }
    });
});

describe('e2e job timeout-minutes', () => {
    it('template e2e is 30 for PR/master shards and 60 for unsharded CMT', () => {
        assert.equal(jobField(workflow('e2e-functional-template.yml'), 'e2e', 'timeout-minutes'), gha('inputs.cmt && 60 || 30'));
    });

    it('policy 30, install 25, status and summary jobs 10', () => {
        assert.equal(jobField(workflow('e2e-policy.yml'), 'policy', 'timeout-minutes'), '30');
        assert.equal(jobField(workflow('e2e-install.yml'), 'install', 'timeout-minutes'), '25');
        assert.equal(jobField(workflow('e2e-post-os-status.yml'), 'post', 'timeout-minutes'), '10');
        const yml = workflow('e2e-functional.yml');
        for (const job of ['e2e-policy-status', 'tsio-summary']) {
            assert.equal(jobField(yml, job, 'timeout-minutes'), '10', job);
        }
        assert.equal(jobField(workflow('compatibility-matrix-testing.yml'), 'update-final-status', 'timeout-minutes'), '10');
    });
});

describe('CMT posts only e2e/compatibility-matrix-testing', () => {
    const cmt = workflow('compatibility-matrix-testing.yml');

    it('never writes e2e/<os> statuses', () => {
        assert.doesNotMatch(cmt, /updateInitialOsStatuses/);
        assert.doesNotMatch(cmt, /osStatusContext/);
        assert.match(cmt, /perOsCommitStatuses: false/);
        assert.doesNotMatch(cmt, /perOsCommitStatuses: true/);
    });

    it('uses the CMT aggregate context and keeps channel notify on', () => {
        assert.match(cmt, /context: e2e\/compatibility-matrix-testing/);
        assert.match(cmt, /COMMIT_STATUS_CONTEXT: e2e\/compatibility-matrix-testing/);
        assert.match(cmt, /MATTERMOST_CMT_WEBHOOK_URL:/);
        assert.doesNotMatch(cmt, /notifyChannel: false/);
    });

    it('runs unsharded per-OS legs; linux/windows wait on their install job, macos does not', () => {
        assert.match(cmt, /^\s+cmt: true$/m);
        assert.doesNotMatch(cmt, /e2e-macos-install/);
        const linux = jobLines(cmt, 'e2e-linux').join('\n');
        assert.match(linux, /- e2e-linux-install/);
        assert.doesNotMatch(linux, /e2e-(macos|windows)-install/);
        assert.doesNotMatch(jobLines(cmt, 'e2e-macos').join('\n'), /e2e-.*-install/);
        assert.match(jobLines(cmt, 'e2e-windows').join('\n'), /- e2e-windows-install/);
    });
});

describe('e2e node_modules and Electron zip caches', () => {
    const setupDeps = read('.github/actions/e2e-setup-deps/action.yaml');

    function namedStep(name) {
        const start = setupDeps.indexOf(`- name: ${name}`);
        assert.ok(start >= 0, `${name} must exist`);
        const rest = setupDeps.slice(start);
        const next = rest.search(/\n {4}- name: /);
        return next === -1 ? rest : rest.slice(0, next);
    }

    it('restores v9 (lock+patches+nvmrc+arch) and saves with the restore primary key', () => {
        assert.match(
            namedStep('e2e/cache-node-modules'),
            /build-node-modules-v9-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('\*\*\/package-lock\.json', 'patches\/\*\*', '\.nvmrc'\) \}\}/,
        );
        assert.match(namedStep('e2e/cache-electron-zip'), /electron-zip-v1-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}/);
        assert.match(namedStep('e2e/save-node-modules'), /key: \$\{\{ steps\.cache-node-modules\.outputs\.cache-primary-key \}\}/);
        assert.match(namedStep('e2e/save-electron-zip'), /cache-electron-zip\.outputs\.cache-hit != 'true'/);
        assert.match(namedStep('e2e/save-electron-zip'), /cache-node-modules\.outputs\.cache-hit != 'true'/);
        assert.match(namedStep('e2e/save-node-modules'), /continue-on-error: \$\{\{ inputs\.mode == 'restore-or-install' \}\}/);
        assert.match(namedStep('e2e/save-electron-zip'), /continue-on-error: \$\{\{ inputs\.mode == 'restore-or-install' \}\}/);
        assert.match(setupDeps, /node-version-file: "\.nvmrc"/);
    });

    it('Linux/Windows install job writes caches; macOS shards restore-or-install', () => {
        assert.match(workflow('e2e-install.yml'), /mode: install/);
        const macOrRestore = /runner\.os == 'macOS' && 'restore-or-install' \|\| 'restore'/;
        for (const file of ['e2e-functional-template.yml', 'e2e-policy.yml']) {
            assert.match(workflow(file), macOrRestore);
            assert.doesNotMatch(workflow(file), /^\s+npm ci$/m);
        }
    });

    it('skips Windows OS deps on restore so shards do not hit Chocolatey', () => {
        const step = namedStep('e2e/install-os-dependencies');
        assert.match(step, /runner\.os != 'Windows' \|\| inputs\.mode != 'restore'/);
        assert.match(step, /inputs\.mode != 'install' \|\| steps\.cache-node-modules\.outputs\.cache-hit != 'true'/);
    });

    it('ci.yaml and build-for-pr.yml do not share the e2e v9 key', () => {
        assert.doesNotMatch(workflow('ci.yaml'), /build-node-modules-v9-/);
        assert.doesNotMatch(workflow('build-for-pr.yml'), /build-node-modules-v9-/);
    });
});

describe('CI Playwright workers and serial files', () => {
    it('keeps linux CI at 1 worker, macOS at 2, and Windows at 3', () => {
        const src = read('e2e/playwright.config.ts');
        assert.match(src, /macos-26 is 3-core \/ 7 GB/);
        assert.match(src, /case 'linux':\s*return 1;/);
        assert.match(src, /case 'darwin':[\s\S]*?return 2;/);
        assert.match(src, /case 'win32':\s*return 3;/);
    });

    it('CPA, Calls, and policy files stay serial', () => {
        for (const file of [
            'e2e/specs/user_attributes/user_attributes.test.ts',
            'e2e/specs/calls/calls_functionality.test.ts',
            'e2e/specs/calls/slash_commands.test.ts',
            'e2e/specs/calls/keyboard_shortcuts.test.ts',
            'e2e/specs/policy/policy.test.ts',
        ]) {
            assert.match(read(file), /describe\.configure\(\{mode: 'serial'\}\)/, `${file} must stay serial`);
        }
    });
});
