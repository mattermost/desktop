// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, writeConfigFile, demoConfig} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';

test.describe('header', () => {
    test.describe('MM-T2637 Double-Clicking on the header should minimize/maximize the app', () => {
        if (process.platform !== 'linux') {
            test('MM-T2637_1 should maximize on double-clicking the header', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
                const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
                fs.mkdirSync(userDataDir, {recursive: true});
                writeConfigFile(userDataDir, demoConfig);
                const initialBounds = {x: 0, y: 0, width: 800, height: 400, maximized: false};
                fs.writeFileSync(path.join(userDataDir, 'bounds-info.json'), JSON.stringify(initialBounds));
                const {_electron: electron} = await import('playwright');
                const app = await electron.launch({
                    executablePath: electronBinaryPath,
                    args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                    env: {...process.env, NODE_ENV: 'test'},
                    timeout: 60_000,
                });
                try {
                    await waitForAppReady(app);
                    const mainWindow = app.windows().find((w) => w.url().includes('index'));
                    if (!mainWindow) {
                        throw new Error('Main window not found');
                    }
                    const browserWindow = await app.browserWindow(mainWindow);
                    const header = mainWindow.locator('div.topBar');

                    const headerBounds = await header.boundingBox();
                    if (!headerBounds) {
                        throw new Error('Header boundingBox() returned null');
                    }
                    await header.dblclick({position: {x: headerBounds.width / 2, y: headerBounds.height / 2}});
                    const isMaximized = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).isMaximized());
                    expect(isMaximized).toBe(true);
                } finally {
                    await app.close();
                    await waitForLockFileRelease(userDataDir);
                }
            });

            test('MM-T2637_2 should restore on double-clicking the header when maximized', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
                const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
                fs.mkdirSync(userDataDir, {recursive: true});
                writeConfigFile(userDataDir, demoConfig);
                const initialBounds = {x: 0, y: 0, width: 800, height: 400, maximized: false};
                fs.writeFileSync(path.join(userDataDir, 'bounds-info.json'), JSON.stringify(initialBounds));
                const {_electron: electron} = await import('playwright');
                const app = await electron.launch({
                    executablePath: electronBinaryPath,
                    args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                    env: {...process.env, NODE_ENV: 'test'},
                    timeout: 60_000,
                });
                try {
                    await waitForAppReady(app);
                    const mainWindow = app.windows().find((w) => w.url().includes('index'));
                    if (!mainWindow) {
                        throw new Error('Main window not found');
                    }
                    const browserWindow = await app.browserWindow(mainWindow);
                    const header = mainWindow.locator('div.topBar');

                    await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).maximize());
                    const maximized = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).isMaximized());
                    expect(maximized).toBe(true);

                    const headerBox = await header.boundingBox();
                    if (!headerBox) {
                        throw new Error('Header boundingBox() returned null');
                    }

                    await header.dblclick({
                        position: {
                            x: headerBox.width / 2,
                            y: headerBox.height / 2,
                        },
                    });

                    const restored = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).isMaximized());
                    expect(restored).toBe(false);
                } finally {
                    await app.close();
                    await waitForLockFileRelease(userDataDir);
                }
            });
        }
    });
});
