// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as os from 'os';

import {defineConfig} from '@playwright/test';

let platformGrep: RegExp;
if (process.platform === 'darwin') {
    platformGrep = /@all|@darwin/;
} else if (process.platform === 'win32') {
    platformGrep = /@all|@win32/;
} else {
    platformGrep = /@all|@linux/;
}

// Each test gets its own isolated userDataDir (testInfo.outputDir/userdata), so each
// Electron instance has its own SingletonLock — parallel workers never conflict.
// Electron processes are heavy (~300MB each), so cap at 2 in CI and half the CPU
// count locally (max 4). Override with E2E_WORKERS env var.
const cpuCount = os.cpus().length;
const defaultWorkers = process.env.CI ? 2 : Math.min(4, Math.max(1, Math.floor(cpuCount / 2)));
const workers = process.env.E2E_WORKERS ? parseInt(process.env.E2E_WORKERS, 10) : defaultWorkers;
const ciEnvironmentTag = process.env.CI_ENVIRONMENT_NAME;
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

    timeout: 60_000,

    ...(ciEnvironmentTag ? {tag: ciEnvironmentTag} : {}),

    reporter: reporters,

    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: process.platform,
            grep: platformGrep,
        },
    ],
});
