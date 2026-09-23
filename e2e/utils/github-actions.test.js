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
        assert.equal(matrix.linuxRunner, 'ubuntu-latest');
        assert.equal(matrix.macosRunner, 'macos-26');
        assert.equal(matrix.windowsRunner, 'windows-2022');
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
        assert.equal(matrix.linuxRunner, 'ubuntu-latest');
        assert.equal(matrix.macosRunner, '');
        assert.equal(matrix.windowsRunner, '');
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

    it('policy reusable workflow job name equals gh-job-name', () => {
        const yml = fs.readFileSync(path.join(workflowsDir, 'e2e-policy.yml'), 'utf8');
        const name = yml.match(/^[ ]{4}name: (policy-tests-\$\{\{ inputs\.platform \}\})$/m);
        const gh = yml.match(/gh-job-name: (policy-tests-\$\{\{ inputs\.platform \}\})$/m);
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

    function jobLines(source, jobId) {
        const lines = source.split(/\r?\n/);
        const header = `  ${jobId}:`;
        const start = lines.indexOf(header);
        assert.ok(start >= 0, `${jobId} must exist`);
        let end = lines.length;
        for (let i = start + 1; i < lines.length; i++) {
            if ((/^ {2}\S/).test(lines[i])) {
                end = i;
                break;
            }
        }
        return lines.slice(start, end);
    }

    function jobTimeoutMinutes(file, jobId) {
        const source = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        for (const line of jobLines(source, jobId)) {
            const match = line.match(/^ {4}timeout-minutes: (.+)$/);
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
        assert.equal(jobTimeoutMinutes('e2e-policy.yml', 'policy'), '30');
        assert.equal(jobTimeoutMinutes('e2e-install.yml', 'install'), '25');
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
        assert.match(cmt, /e2e-linux-install:/);
        assert.match(cmt, /e2e-macos-install:/);
        assert.match(cmt, /e2e-windows-install:/);
        assert.doesNotMatch(cmt, /^ {2}e2e:$/m);
    });

    it('CMT linux tests wait only on linux install, not macos/windows install', () => {
        const cmt = fs.readFileSync(path.join(workflowsDir, 'compatibility-matrix-testing.yml'), 'utf8');
        const crlf = cmt.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
        for (const source of [cmt, crlf]) {
            const block = jobLines(source, 'e2e-linux').join('\n');
            assert.match(block, /- e2e-linux-install/);
            assert.doesNotMatch(block, /e2e-macos-install/);
            assert.doesNotMatch(block, /e2e-windows-install/);
        }
    });
});

describe('CMT posts only e2e/compatibility-matrix-testing', () => {
    const workflowsDir = path.join(__dirname, '../../.github/workflows');
    const cmt = fs.readFileSync(path.join(workflowsDir, 'compatibility-matrix-testing.yml'), 'utf8');
    const pr = fs.readFileSync(path.join(workflowsDir, 'e2e-functional.yml'), 'utf8');

    it('does not pending-flip e2e/<os> or call updateInitialOsStatuses', () => {
        assert.doesNotMatch(cmt, /updateInitialOsStatuses/);
        assert.doesNotMatch(cmt, /Post pending e2e\/linux/);
        assert.doesNotMatch(cmt, /osStatusContext/);
    });

    it('pending and final statuses use the CMT aggregate context', () => {
        assert.match(cmt, /context: e2e\/compatibility-matrix-testing/);
        assert.match(cmt, /COMMIT_STATUS_CONTEXT: e2e\/compatibility-matrix-testing/);
        assert.match(cmt, /perOsCommitStatuses: false/);
        assert.doesNotMatch(cmt, /perOsCommitStatuses: true/);
    });

    it('still posts the CMT channel (TSIO notify stays on)', () => {
        assert.match(cmt, /MATTERMOST_CMT_WEBHOOK_URL:/);
        assert.match(cmt, /failOnTestFailures: true/);
        assert.doesNotMatch(cmt, /notifyChannel: false/);
    });

    it('PR/master still pending-flips e2e/<os> and policy', () => {
        assert.match(pr, /Post pending e2e\/linux\|macos\|windows \(\+ policy\)/);
        assert.match(pr, /includePolicy: true/);
        assert.match(pr, /name: Post e2e\/linux/);
        assert.match(pr, /name: Post e2e\/macos/);
        assert.match(pr, /name: Post e2e\/windows/);
        assert.match(pr, /Flip e2e\/macos-policy and e2e\/windows-policy/);
        assert.equal((pr.match(/perOsCommitStatuses: true/g) || []).length, 4);
        assert.match(pr, /perOsCommitStatuses: false/);
    });
});

describe('e2e/policy node_modules cache key includes patches, arch, and nvmrc', () => {
    const workflowsDir = path.join(__dirname, '../../.github/workflows');
    const actionsDir = path.join(__dirname, '../../.github/actions');
    const restoreV9Key = /build-node-modules-v9-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('(\*\*\/package-lock\.json)', 'patches\/\*\*', '\.nvmrc'\) \}\}/;
    const savePrimaryKey = /key: \$\{\{ steps\.cache-node-modules\.outputs\.cache-primary-key \}\}/;
    const electronZipKey = /electron-zip-v1-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}/;

    function workflowSource(file) {
        return fs.readFileSync(path.join(workflowsDir, file), 'utf8');
    }

    function namedStep(yml, name) {
        const marker = `- name: ${name}`;
        const start = yml.indexOf(marker);
        assert.ok(start >= 0, `${name} must exist`);
        const rest = yml.slice(start);
        const next = rest.search(/\n {4}- name: /);
        return next === -1 ? rest : rest.slice(0, next);
    }

    it('setup-deps composite restores v9 (lock+patches+nvmrc) and the Electron zip', () => {
        const yml = fs.readFileSync(path.join(actionsDir, 'e2e-setup-deps/action.yaml'), 'utf8');
        const restore = namedStep(yml, 'e2e/cache-node-modules');
        assert.match(restore, /id: cache-node-modules/);
        assert.match(restore, restoreV9Key);
        assert.match(namedStep(yml, 'e2e/cache-electron-zip'), electronZipKey);
        assert.match(namedStep(yml, 'e2e/save-node-modules'), savePrimaryKey);
        assert.doesNotMatch(namedStep(yml, 'e2e/save-node-modules'), /key:.*hashFiles/);
        assert.match(yml, /node-version-file: "\.nvmrc"/);
        assert.doesNotMatch(yml, /node-version: '22\.x'/);
        assert.match(yml, /mode == 'install'/);
        assert.match(yml, /mode == 'restore'/);
    });

    it('template and policy restore via e2e-setup-deps (no per-shard npm ci)', () => {
        assert.match(workflowSource('e2e-functional-template.yml'), /mode: restore/);
        assert.match(workflowSource('e2e-policy.yml'), /mode: restore/);
        assert.doesNotMatch(workflowSource('e2e-functional-template.yml'), /node-version: '22\.x'/);
        assert.doesNotMatch(workflowSource('e2e-policy.yml'), /node-version: '22\.x'/);
        assert.doesNotMatch(workflowSource('e2e-functional-template.yml'), /^\s+npm ci$/m);
        assert.doesNotMatch(workflowSource('e2e-policy.yml'), /^\s+npm ci$/m);
    });

    it('install workflow is the npm ci writer and uploads npm debug logs on failure', () => {
        const yml = workflowSource('e2e-install.yml');
        assert.match(yml, /mode: install/);
        assert.match(yml, /e2e\/upload-npm-debug-logs/);
        assert.match(yml, /e2e-npm-debug-/);
    });

    it('PR e2e shards and policy wait on the per-OS install job', () => {
        const yml = workflowSource('e2e-functional.yml');
        assert.match(yml, /e2e-linux-install:/);
        assert.match(yml, /e2e-macos-install:/);
        assert.match(yml, /e2e-windows-install:/);
        assert.match(yml, /e2e-policy-macos:/);
        assert.match(yml, /e2e-policy-windows:/);
        assert.match(yml, /name: E2E Linux \(\$\{\{ matrix\.shardDisplay \}\}\)/);
        assert.match(yml, /- e2e-linux-install/);
        assert.match(yml, /- e2e-macos-install/);
        assert.match(yml, /- e2e-windows-install/);
    });

    it('ci.yaml and build-for-pr.yml do not share the e2e v9 key', () => {
        assert.doesNotMatch(workflowSource('ci.yaml'), /build-node-modules-v9-/);
        assert.doesNotMatch(workflowSource('build-for-pr.yml'), /build-node-modules-v9-/);
    });

    it('install job saves node_modules and the Electron zip on PRs (not MASTER-only)', () => {
        const yml = fs.readFileSync(path.join(actionsDir, 'e2e-setup-deps/action.yaml'), 'utf8');
        assert.doesNotMatch(yml, /TYPE == 'MASTER'/);
        assert.doesNotMatch(yml, /run_type == 'MASTER'/);
        assert.match(namedStep(yml, 'e2e/save-electron-zip'), /cache-electron-zip\.outputs\.cache-hit != 'true'/);
        assert.match(namedStep(yml, 'e2e/save-electron-zip'), /cache-node-modules\.outputs\.cache-hit != 'true'/);
        assert.match(yml, /electron_config_cache/);
        assert.match(yml, /github\.workspace/);
    });
});

describe('CI Playwright workers and serial files', () => {
    const repoRoot = path.join(__dirname, '../..');

    it('keeps linux CI at 1 worker and raises macOS/Windows CI to 3', () => {
        const src = fs.readFileSync(path.join(repoRoot, 'e2e/playwright.config.ts'), 'utf8');
        assert.match(src, /getActivePlatform\(\) === 'linux' \? 1 : 3/);
    });

    it('postinstall wraps electron/install.js and logs fetch URL + cause', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
        assert.match(pkg.scripts.postinstall, /node scripts\/electron-install\.js/);
        const src = fs.readFileSync(path.join(repoRoot, 'scripts/electron-install.js'), 'utf8');
        assert.match(src, /fetch failed for/);
        assert.match(src, /printCauseChain/);
        assert.match(src, /electron\/install\.js/);
    });

    it('CPA, Calls, and policy files stay serial', () => {
        const files = [
            'e2e/specs/user_attributes/user_attributes.test.ts',
            'e2e/specs/calls/calls_functionality.test.ts',
            'e2e/specs/calls/slash_commands.test.ts',
            'e2e/specs/calls/keyboard_shortcuts.test.ts',
            'e2e/specs/policy/policy.test.ts',
        ];
        for (const file of files) {
            const src = fs.readFileSync(path.join(repoRoot, file), 'utf8');
            assert.match(src, /describe\.configure\(\{mode: 'serial'\}\)/, `${file} must stay serial`);
        }
    });
});
