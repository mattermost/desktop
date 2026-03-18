// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';
import * as path from 'path';

import {test as base, type Page} from '@playwright/test';
import type {ElectronApplication} from 'playwright';
import {_electron as electron} from 'playwright';

import {waitForAppReady} from '../helpers/appReadiness';
import {waitForLockFileRelease} from '../helpers/cleanup';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile, type AppConfig} from '../helpers/config';
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
    appConfig: async ({}, use) => {
        await use(demoConfig);
    },

    electronApp: async ({appConfig}, use, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        await fs.rm(userDataDir, {recursive: true, force: true});
        await fs.mkdir(userDataDir, {recursive: true});

        // writeConfigFile is SYNCHRONOUS — must complete before electron.launch()
        writeConfigFile(userDataDir, appConfig);

        let launchTimeout: number;
        if (process.platform === 'win32') {
            launchTimeout = 120_000;
        } else if (process.platform === 'darwin') {
            launchTimeout = 90_000;
        } else {
            launchTimeout = 60_000;
        }

        const E2E_PROCESS_REGISTRY = path.join(os.tmpdir(), 'mattermost-desktop-e2e-main-pids.txt');

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [
                appDir, // test build directory (e2e/dist)
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

        // Register PID for global teardown orphan cleanup.
        // electronApp.process().pid is available here from Playwright at runtime,
        // so we write it from the test side rather than from inside the app.
        const launchPid = app.process()?.pid;
        if (launchPid) {
            try {
                fsSync.appendFileSync(E2E_PROCESS_REGISTRY, `${launchPid}\n`, 'utf8');
            } catch { /* non-fatal */ }
        }

        await use(app);

        // Teardown strategy:
        //   1. Try app.close() (clean Playwright shutdown) with a 10s cap.
        //   2. If it hangs, send SIGTERM and return immediately — do NOT SIGKILL.
        //   SIGKILL triggers macOS "Electron quit unexpectedly" crash dialogs.
        //   SIGTERM does not. Global teardown (pkill targeting main process only)
        //   will reap any lingering orphans after the full suite completes.
        let pid: number | undefined;
        try {
            pid = app.process()?.pid;
        } catch { /* app already disconnected */ }

        let cleanClosed = false;
        await Promise.race([
            app.close().catch(() => {}).then(() => {
                cleanClosed = true;
            }),
            new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
        ]);

        if (!cleanClosed && pid) {
            try {
                process.kill(pid, 'SIGTERM');
            } catch { /* already gone */ }
            // Return immediately — don't wait for the process to exit.
            // Lock-file cleanup is not needed: each test has a unique userDataDir
            // so a lingering lock never blocks the next test.
            return;
        }

        await waitForLockFileRelease(userDataDir).catch(() => {});
    },

    // Deduplicated readiness gate. Both serverMap and mainWindow declare this
    // as a dependency — Playwright runs it exactly once and tears it down once.
    appReady: async ({electronApp}, use) => {
        await waitForAppReady(electronApp);
        await use();
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    serverMap: async ({electronApp, appReady: _appReady}, use) => {
        const map = await buildServerMap(electronApp);
        await use(map);
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mainWindow: async ({electronApp, appReady: _appReady}, use) => {
        let win: Page | undefined;
        const timeoutAt = Date.now() + 30_000;

        while (Date.now() < timeoutAt) {
            win = electronApp.windows().find((w) => {
                try {
                    return w.url().includes('index');
                } catch {
                    return false;
                }
            });

            if (win) {
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 200));
        }

        if (!win) {
            throw new Error(
                'mainWindow fixture: no window with \'index\' in URL.\n' +
                `Available: ${electronApp.windows().map((w) => w.url()).join(', ')}`,
            );
        }
        await use(win);
    },
});

export {expect} from '@playwright/test';
