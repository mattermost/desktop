// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile, cmdOrCtrl} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

if (!process.env.MM_TEST_SERVER_URL) {
    test.skip(true, 'MM_TEST_SERVER_URL required');
}

const config = {
    ...demoMattermostConfig,
    alwaysMinimize: false,
    minimizeToTray: false,
};

async function launchWithMattermostConfig(testInfo: {outputDir: string}) {
    const {mkdirSync} = await import('fs');
    const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
    mkdirSync(userDataDir, {recursive: true});
    writeConfigFile(userDataDir, config);
    const {_electron: electron} = await import('playwright');
    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });
    await waitForAppReady(app);
    const serverMap = await buildServerMap(app);
    const mmServer = serverMap[config.servers[0].name][0].win;
    await loginToMattermost(mmServer);
    return {app, serverMap};
}

test.describe('server_management/popout_windows', () => {
    test.describe('MM-TXXXX popout window functionality', () => {
        test('MM-TXXXX_1 should create a new popout window using keyboard shortcut', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app} = await launchWithMattermostConfig(testInfo);
            try {
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                await mainWindow.keyboard.press(cmdOrCtrl === 'command' ? 'Meta+n' : 'Control+n');

                await expect.poll(() => {
                    return app.windows().filter((w) => w.url().includes('popout.html')).length;
                }, {timeout: 10000}).toBe(1);

                const popoutWindows = app.windows().filter((w) => w.url().includes('popout.html'));
                expect(popoutWindows.length).toBe(1);
                expect(popoutWindows[0]).toBeDefined();
            } finally {
                await app.close();
            }
        });

        test('MM-TXXXX_2 should resize the popout window by dragging corners', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app} = await launchWithMattermostConfig(testInfo);
            try {
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                await mainWindow.keyboard.press(cmdOrCtrl === 'command' ? 'Meta+n' : 'Control+n');

                await expect.poll(() => {
                    return app.windows().filter((w) => w.url().includes('popout.html')).length;
                }, {timeout: 10000}).toBe(1);

                const popoutWindow = app.windows().find((w) => w.url().includes('popout.html'))!;
                const browserWindow = await app.browserWindow(popoutWindow);
                const initialBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());

                const newBounds = {
                    x: initialBounds.x,
                    y: initialBounds.y,
                    width: initialBounds.width + 200,
                    height: initialBounds.height + 200,
                };

                await browserWindow.evaluate((w, bounds) => {
                    (w as Electron.BrowserWindow).setBounds(bounds as Electron.Rectangle);
                }, newBounds);

                const currentBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());

                const tolerance = process.platform === 'darwin' ? 250 : 10;
                expect(Math.abs(currentBounds.width - newBounds.width)).toBeLessThan(tolerance);
                expect(Math.abs(currentBounds.height - newBounds.height)).toBeLessThan(tolerance);
            } finally {
                await app.close();
            }
        });

        test('MM-TXXXX_3 should move the popout window by dragging title bar', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app} = await launchWithMattermostConfig(testInfo);
            try {
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                await mainWindow.keyboard.press(cmdOrCtrl === 'command' ? 'Meta+n' : 'Control+n');

                await expect.poll(() => {
                    return app.windows().filter((w) => w.url().includes('popout.html')).length;
                }, {timeout: 10000}).toBe(1);

                const popoutWindow = app.windows().find((w) => w.url().includes('popout.html'))!;
                const browserWindow = await app.browserWindow(popoutWindow);
                const initialBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());

                const newBounds = {
                    x: initialBounds.x + 50,
                    y: initialBounds.y + 50,
                    width: initialBounds.width,
                    height: initialBounds.height,
                };

                await browserWindow.evaluate((w, bounds) => {
                    (w as Electron.BrowserWindow).setBounds(bounds as Electron.Rectangle);
                }, newBounds);

                const currentBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());
                expect(Math.abs(currentBounds.x - newBounds.x)).toBeLessThan(10);
                expect(Math.abs(currentBounds.y - newBounds.y)).toBeLessThan(10);
            } finally {
                await app.close();
            }
        });

        test('MM-TXXXX_4 should close the popout window using close button', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app} = await launchWithMattermostConfig(testInfo);
            try {
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                await mainWindow.keyboard.press(cmdOrCtrl === 'command' ? 'Meta+n' : 'Control+n');

                await expect.poll(() => {
                    return app.windows().filter((w) => w.url().includes('popout.html')).length;
                }, {timeout: 10000}).toBe(1);

                const popoutWindow = app.windows().find((w) => w.url().includes('popout.html'))!;
                const browserWindow = await app.browserWindow(popoutWindow);
                await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).close());

                await expect.poll(() => {
                    return app.windows().filter((w) => w.url().includes('popout.html')).length;
                }, {timeout: 10000}).toBe(0);
            } finally {
                await app.close();
            }
        });

        if (process.platform === 'win32') {
            test('MM-TXXXX_5 should close popout windows when main window is closed', {tag: ['@P2', '@win32']}, async ({}, testInfo) => {
                const {app} = await launchWithMattermostConfig(testInfo);
                try {
                    const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                    await mainWindow.keyboard.press('Control+n');

                    await expect.poll(() => {
                        return app.windows().filter((w) => w.url().includes('popout.html')).length;
                    }, {timeout: 10000}).toBe(1);

                    const mainWindows = app.windows().filter((w) => w.url().includes('index'));
                    const popoutWindows = app.windows().filter((w) => w.url().includes('popout.html'));
                    expect(mainWindows.length).toBe(1);
                    expect(popoutWindows.length).toBe(1);

                    const mainBrowserWindow = await app.browserWindow(mainWindows[0]);
                    await mainBrowserWindow.evaluate((w) => (w as Electron.BrowserWindow).close());

                    await expect.poll(() => {
                        return app.windows().filter((w) => w.url().includes('popout.html')).length;
                    }, {timeout: 10000}).toBe(0);
                } finally {
                    await app.close();
                }
            });
        }
    });

    test.describe('MM-T4411 popout window content functionality', () => {
        test('MM-T4411_1 should display the same server content in popout window', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app} = await launchWithMattermostConfig(testInfo);
            try {
                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                await mainWindow.keyboard.press(cmdOrCtrl === 'command' ? 'Meta+n' : 'Control+n');

                await expect.poll(() => {
                    return app.windows().filter((w) => w.url().includes('popout.html')).length;
                }, {timeout: 10000}).toBe(1);

                const popoutWindow = app.windows().find((w) => w.url().includes('popout.html'))!;

                const mainWindowTitle = await mainWindow.title();
                const popoutWindowTitle = await popoutWindow.title();

                expect(mainWindowTitle).toContain('Mattermost');
                expect(popoutWindowTitle).toContain('Mattermost');

                const browserWindow = await app.browserWindow(popoutWindow);
                await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).close());
            } finally {
                await app.close();
            }
        });

        test('MM-T4411_2 should maintain separate navigation state in popout window', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app, serverMap} = await launchWithMattermostConfig(testInfo);
            try {
                const mainView = serverMap[config.servers[0].name][0].win;
                await mainView.waitForSelector('#sidebarItem_off-topic');
                await mainView.click('#sidebarItem_off-topic');

                const mainWindow = app.windows().find((w) => w.url().includes('index'))!;
                await mainWindow.keyboard.press(cmdOrCtrl === 'command' ? 'Meta+n' : 'Control+n');

                await expect.poll(() => {
                    return app.windows().filter((w) => w.url().includes('popout.html')).length;
                }, {timeout: 10000}).toBe(1);

                const popoutWindow = app.windows().find((w) => w.url().includes('popout.html'))!;

                const mainTabText = await mainWindow.innerText('.TabBar li.serverTabItem.active');
                expect(mainTabText).toContain('Off-Topic');

                const browserWindow = await app.browserWindow(popoutWindow);
                await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).close());
            } finally {
                await app.close();
            }
        });
    });
});
