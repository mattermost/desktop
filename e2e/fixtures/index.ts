// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as path from 'path';

import {test as base, type Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';
import {_electron as electron} from 'playwright';

import {waitForAppReady, waitForMainWindow, waitForMainWindowChrome} from '../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile, type AppConfig} from '../helpers/config';
import {
    closeElectronApp,
    FAST_TEARDOWN,
    registerElectronMainProcess,
    cleanupRegisteredElectronProcesses,
} from '../helpers/electronApp';
import {closeOverlayWindowsIfOpen} from '../helpers/overlayWindows';
import {buildServerMap, type ServerMap} from '../helpers/serverMap';

export type {ServerMap, ServerEntry} from '../helpers/serverMap';
export type {AppConfig} from '../helpers/config';

type Fixtures = {

    /**
     * Config written to userDataDir before Electron launches.
     * Defaults to demoConfig. Override with test.use({ appConfig: myConfig }).
     */
    appConfig: AppConfig;

    /**
     * A launched ElectronApplication with its own isolated userDataDir.
     * Guaranteed torn down (app.close() + lock file release) after each test.
     * Config defaults to demoConfig (example.com + github.com).
     * Override config with test.use({ appConfig: demoMattermostConfig }).
     */
    electronApp: ElectronApplication;

    /**
     * Side-effect fixture: waits until __e2eAppReady is true, then (when config
     * lists servers) until the main-window server dropdown button is visible.
     * Both serverMap and mainWindow depend on this. Playwright deduplicates it.
     */
    appReady: void;

    /** Map of server name → [{win, webContentsId}] for external server views. */
    serverMap: ServerMap;

    /** The main internal window (mattermost-desktop://renderer/index.html). */
    mainWindow: Page;
};

type WorkerFixtures = {

    /** Worker-scoped cleanup for orphaned Electron main processes. */
    workerElectronCleanup: void;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
    workerElectronCleanup: [async ({}, use) => {
        await use();
        let timeoutHandle: NodeJS.Timeout | undefined;
        try {
            await Promise.race([
                cleanupRegisteredElectronProcesses(),
                new Promise<void>((resolve) => {
                    timeoutHandle = setTimeout(resolve, 20_000);
                    timeoutHandle.unref?.();
                }),
            ]);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }, {scope: 'worker'}],

    appConfig: async ({}, use) => {
        await use(demoConfig);
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    electronApp: async ({appConfig, workerElectronCleanup: _workerElectronCleanup}, use, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        await fs.rm(userDataDir, {recursive: true, force: true});
        await fs.mkdir(userDataDir, {recursive: true});

        writeConfigFile(userDataDir, appConfig);

        let launchTimeout: number;
        if (process.platform === 'win32') {
            launchTimeout = 120_000;
        } else if (process.platform === 'darwin') {
            launchTimeout = 90_000;
        } else {
            launchTimeout = 60_000;
        }

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [
                appDir,
                `--user-data-dir=${userDataDir}`,
                '--no-sandbox',
                '--disable-gpu',
                '--disable-gpu-sandbox',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--disable-software-rasterizer',
                '--disable-breakpad',
                '--disable-features=SpareRendererForSitePerProcess',
                '--disable-features=CrossOriginOpenerPolicy',
                '--disable-renderer-backgrounding',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps',
                '--disable-crash-reporter',
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

        registerElectronMainProcess(app.process()?.pid);

        await use(app);

        await closeElectronApp(app, userDataDir, FAST_TEARDOWN);
        await fs.rm(userDataDir, {recursive: true, force: true}).catch(() => {});
    },

    appReady: async ({electronApp, appConfig}, use) => {
        await waitForAppReady(electronApp);

        // Setup path: the main process is freshly launched and responsive, so
        // the default 3s bound is ample for sub-100ms dropdown closes and still
        // fails fast if app.evaluate hangs. No larger setup timeout is needed.
        await closeOverlayWindowsIfOpen(electronApp);

        if (appConfig.servers.length > 0) {
            await waitForMainWindowChrome(electronApp, {requireServerDropdown: true});
        }

        await use();
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    serverMap: async ({electronApp, appReady: _appReady}, use) => {
        const map = await buildServerMap(electronApp);
        await use(map);
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mainWindow: async ({electronApp, appReady: _appReady}, use) => {
        const win = await waitForMainWindow(electronApp);
        await use(win);
    },
});

export {expect} from '@playwright/test';
