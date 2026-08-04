// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';
import {closeElectronAppFast} from '../../helpers/electronApp';

test(
    'main window can be hidden to tray and restored',
    {tag: ['@P0', '@all']},
    async ({}, testInfo) => {
        const {mkdirSync} = await import('fs');
        const userDataDir = path.join(testInfo.outputDir, 'tray-userdata');
        mkdirSync(userDataDir, {recursive: true});

        // Enable tray + minimize-to-tray
        writeConfigFile(userDataDir, {
            ...demoConfig,
            showTrayIcon: true,
            minimizeToTray: true,
        });

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 90_000,
        });

        try {
            await waitForAppReady(app);

            // Verify main window is visible. Poll rather than asserting once —
            // `waitForAppReady` resolves when the `show` event fires, but on some
            // Linux WMs (xvfb in CI) `isVisible()` can briefly report false right
            // after the event before the WM has fully mapped the window.
            await expect.poll(
                () => app.evaluate(({BrowserWindow}) =>
                    BrowserWindow.getAllWindows().some((w) => w.isVisible()),
                ),
                {timeout: 10_000, message: 'Main window should be visible after launch'},
            ).toBe(true);

            // Simulate "close to tray": hide the main window
            // (the actual close handler calls win.hide() when minimizeToTray is true)
            await app.evaluate(({BrowserWindow}) => {
                const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
                win?.hide();
            });

            // Window should now be hidden (not destroyed)
            await expect.poll(
                () => app.evaluate(({BrowserWindow}) =>
                    BrowserWindow.getAllWindows().some((w) => w.isVisible()),
                ),
                {timeout: 5_000, message: 'Window should be hidden after hide()'},
            ).toBe(false);

            // Verify the window still exists (not destroyed) — this is the key invariant
            const windowStillExists = await app.evaluate(({BrowserWindow}) =>
                BrowserWindow.getAllWindows().some((w) => !w.isDestroyed()),
            );
            expect(windowStillExists).toBe(true);

            // Simulate tray restore: show the window
            // (TrayIcon.onClick calls MainWindow.show() → BrowserWindow.show())
            await app.evaluate(({BrowserWindow}) => {
                const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
                win?.show();
                win?.focus();
            });

            // Window should reappear
            await expect.poll(
                () => app.evaluate(({BrowserWindow}) =>
                    BrowserWindow.getAllWindows().some((w) => w.isVisible()),
                ),
                {timeout: 5_000, message: 'Window did not reappear after show()'},
            ).toBe(true);
        } finally {
            await closeElectronAppFast(app, userDataDir);
        }
    },
);
