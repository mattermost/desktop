// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@playwright/test';

export default defineConfig({
    testDir: './specs',
    testMatch: '**/*.test.ts',

    // Electron is not a browser — each worker spawns a full ~300MB process.
    // More than 1 worker in CI causes: xvfb focus races (Linux), dock API
    // conflicts (macOS), RAM OOM (Windows).
    workers: process.env.CI ? 1 : 2,
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
            grep: process.platform === 'darwin' ? /@all|@darwin/ :
                  process.platform === 'win32'  ? /@all|@win32/ :
                  /@all|@linux/,
        },
    ],
});
