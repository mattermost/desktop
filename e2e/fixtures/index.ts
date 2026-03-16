// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as path from 'path';

import {test as base, type Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';
import {_electron as electron} from 'playwright';

import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../helpers/config';
import {waitForAppReady} from '../helpers/appReadiness';
import {waitForLockFileRelease} from '../helpers/cleanup';
import {buildServerMap, type ServerMap} from '../helpers/serverMap';

export type {ServerMap, ServerEntry} from '../helpers/serverMap';

type Fixtures = {
    /**
     * A launched ElectronApplication with its own isolated userDataDir.
     * Guaranteed torn down (app.close() + lock file release) after each test.
     * Config defaults to demoConfig (example.com + github.com).
     * Override config by passing a custom config to writeConfigFile() in beforeEach.
     */
    electronApp: ElectronApplication;

    /**
     * Side-effect fixture: waits until __e2eAppReady is true in the main process.
     * Both serverMap and mainWindow depend on this. Playwright deduplicates it —
     * waitForAppReady() runs exactly once even if both fixtures are requested.
     */
    appReady: void;

    /** Map of server name → [{win, webContentsId}] for external server views. */
    serverMap: ServerMap;

    /** The main internal window (mattermost-desktop://renderer/index.html). */
    mainWindow: Page;
};

export const test = base.extend<Fixtures>({
    electronApp: async ({}, use, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        await fs.mkdir(userDataDir, {recursive: true});

        // writeConfigFile is SYNCHRONOUS — must complete before electron.launch()
        writeConfigFile(userDataDir, demoConfig);

        const launchTimeout = process.platform === 'win32' ? 120_000 :
                              process.platform === 'darwin' ? 90_000 : 60_000;

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [
                appDir,                              // test build directory (e2e/dist)
                `--user-data-dir=${userDataDir}`,

                // CI compatibility — required for Linux sandbox, GPU stability
                '--no-sandbox',
                '--disable-gpu',
                '--disable-gpu-sandbox',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--disable-software-rasterizer',

                // Stability
                '--disable-breakpad',
                '--disable-features=SpareRendererForSitePerProcess',
                '--disable-features=CrossOriginOpenerPolicy',
                '--disable-renderer-backgrounding',

                // Consistency
                '--force-color-profile=srgb',
                '--mute-audio',
            ],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                RESOURCES_PATH: appDir,
                ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
                ELECTRON_NO_ATTACH_CONSOLE: 'true',
                NODE_OPTIONS: '--no-warnings',
            },
            timeout: launchTimeout,
        });

        await use(app);

        await app.close();
        await waitForLockFileRelease(userDataDir);
    },

    // Deduplicated readiness gate. Both serverMap and mainWindow declare this
    // as a dependency — Playwright runs it exactly once and tears it down once.
    appReady: async ({electronApp}, use) => {
        await waitForAppReady(electronApp);
        await use();
    },

    serverMap: async ({electronApp, appReady: _}, use) => {
        const map = await buildServerMap(electronApp);
        await use(map);
    },

    mainWindow: async ({electronApp, appReady: _}, use) => {
        const win = electronApp.windows().find((w) => w.url().includes('index'));
        if (!win) {
            throw new Error(
                `mainWindow fixture: no window with 'index' in URL.\n` +
                `Available: ${electronApp.windows().map((w) => w.url()).join(', ')}`,
            );
        }
        await use(win);
    },
});

export {expect} from '@playwright/test';
