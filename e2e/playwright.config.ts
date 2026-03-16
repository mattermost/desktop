// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@playwright/test';

let platformGrep: RegExp;
if (process.platform === 'darwin') {
    platformGrep = /@all|@darwin/;
} else if (process.platform === 'win32') {
    platformGrep = /@all|@win32/;
} else {
    platformGrep = /@all|@linux/;
}

export default defineConfig({
    testDir: './specs',
    testMatch: '**/*.test.ts',
    globalTeardown: './global-teardown.ts',

    // Electron is not a browser — each worker spawns a full ~300MB process.
    // Multiple simultaneous Electron instances cause singleton lock races,
    // xvfb focus conflicts (Linux), dock API conflicts (macOS), and RAM OOM (Windows).
    workers: 1,
    fullyParallel: false,

    retries: process.env.CI ? 1 : 0,

    timeout: 60_000,

    reporter: [
        ['html', {open: 'never', outputFolder: 'playwright-report'}],
        ['list'],
    ],

    use: {
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: process.platform,
            grep: platformGrep,
        },
    ],
});
