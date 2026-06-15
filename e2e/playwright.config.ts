// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as os from 'os';

import {defineConfig, type Project} from '@playwright/test';

type Platform = 'linux' | 'darwin' | 'win32';

function getActivePlatform(): Platform {
    if (process.platform === 'darwin') {
        return 'darwin';
    }
    if (process.platform === 'win32') {
        return 'win32';
    }
    return 'linux';
}

const PLATFORM_GREP: Record<Platform, RegExp> = {
    linux: /@all|@linux/,
    darwin: /@all|@darwin/,
    win32: /@all|@win32/,
};

// Each test gets its own isolated userDataDir (testInfo.outputDir/userdata), so each
// Electron instance has its own SingletonLock — parallel workers never conflict.
// Electron processes are heavy (~300MB each), so cap at 2 in CI and half the CPU
// count locally (max 4). Override with E2E_WORKERS env var.
const cpuCount = os.cpus().length;
const defaultWorkers = process.env.CI ? 2 : Math.min(4, Math.max(1, Math.floor(cpuCount / 2)));
const workers = process.env.E2E_WORKERS ? parseInt(process.env.E2E_WORKERS, 10) : defaultWorkers;

// Prepended to each test in blob/HTML reports so multi-environment runs are distinguishable
// when merging. Must NOT reuse platform grep tokens (@linux, @darwin, @win32, @all) —
// Playwright inherits config tags onto file suites, which would make Linux grep match
// every test when CI used to set CI_ENVIRONMENT_NAME=@linux.
function getReportTag(): string | undefined {
    const raw = process.env.CI_ENVIRONMENT_NAME;
    if (!raw) {
        return undefined;
    }

    const legacyReportTags: Record<string, string> = {
        '@linux': '@ci-linux',
        '@macos': '@ci-macos',
        '@windows': '@ci-windows',
    };

    return legacyReportTags[raw] ?? raw;
}

const reportTag = getReportTag();
const excludePolicyFromMainRun = Boolean(process.env.CI) && process.env.RUN_POLICY_E2E !== 'true';
const activePlatform = getActivePlatform();

function buildPlatformProjects(): Project[] {
    const policyFilter = excludePolicyFromMainRun ? {grepInvert: /[/\\]policy[/\\]/} : {};

    const projects: Project[] = [
        {
            name: activePlatform,
            grep: PLATFORM_GREP[activePlatform],
            ...policyFilter,
        },
    ];

    if (process.env.E2E_WAYLAND === 'true' && activePlatform === 'linux') {
        projects.push({
            name: 'wayland',
            grep: /@wayland/,
        });
    }

    return projects;
}

const reporters = process.env.CI ? [
    ['blob', {outputDir: 'blob-report'}],
    ['line'],
    ['junit', {outputFile: 'test-results/e2e-junit.xml'}],
] as const : [
    ['html', {open: 'never', outputFolder: 'playwright-report'}],
    ['list'],
] as const;

export default defineConfig({
    testDir: './specs',
    testMatch: '**/*.test.ts',
    globalSetup: './global-setup.ts',
    globalTeardown: './global-teardown.ts',

    workers,
    fullyParallel: true,

    retries: process.env.CI ? 1 : 0,

    // 90s per test/hook. The Windows GitHub-hosted runner can take 30–60s just
    // to launch Electron + reach `__e2eAppReady`; many tests then need their
    // own beforeAll launch. The previous 60s budget caused ~17 Windows
    // hook/test timeouts on every run. 90s gives the launch + setup head-room
    // while still failing reasonably fast on a genuinely-stuck test.
    timeout: 90_000,

    ...(reportTag ? {tag: reportTag} : {}),

    reporter: reporters,

    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: buildPlatformProjects(),
});
