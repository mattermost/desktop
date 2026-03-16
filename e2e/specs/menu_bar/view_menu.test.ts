// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig, cmdOrCtrl} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';


function getZoomFactorOfServer(browserWindow: any, serverId: number) {
    return browserWindow.evaluate(
        (window: any, id: number) => window.contentView.children.find((view: any) => view.webContents.id === id).webContents.getZoomFactor(),
        serverId,
    );
}

function setZoomFactorOfServer(browserWindow: any, serverId: number, zoomFactor: number) {
    return browserWindow.evaluate(
        (window: any, {id, zoom}: {id: number; zoom: number}) => window.contentView.children.find((view: any) => view.webContents.id === id).webContents.setZoomFactor(zoom),
        {id: serverId, zoom: zoomFactor},
    );
}

test.describe('menu/view', () => {
    test('MM-T813 Control+F should focus the search bar in Mattermost', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);
        await firstServer.waitForSelector('#searchFormContainer');

        await firstServer.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+f`);
        const isFocused = await firstServer.$eval('input.search-bar.form-control', (el) => el === document.activeElement);
        expect(isFocused).toBe(true);
        const text = await firstServer.inputValue('input.search-bar.form-control');
        expect(text).toContain('in:');
    });

    test('MM-T817 Actual Size Zoom in the menu bar', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const browserWindow = await electronApp.browserWindow(mainWindow);
        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        const firstServerId = serverMap[demoMattermostConfig.servers[0].name][0].webContentsId;
        await loginToMattermost(firstServer);
        await firstServer.waitForSelector('#searchFormContainer');

        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+=`);
        let zoomLevel = await browserWindow.evaluate((window, id) => (window as any).contentView.children.find((view: any) => view.webContents.id === id).webContents.getZoomFactor(), firstServerId);
        expect(zoomLevel).toBeGreaterThan(1);

        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+0`);
        zoomLevel = await browserWindow.evaluate((window, id) => (window as any).contentView.children.find((view: any) => view.webContents.id === id).webContents.getZoomFactor(), firstServerId);
        expect(zoomLevel).toBe(1);
    });

    test.describe('MM-T818 Zoom in from the menu bar', () => {
        test('MM-T818_1 Zoom in when CmdOrCtrl+Plus is pressed', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const browserWindow = await electronApp.browserWindow(mainWindow);
            const serverMap = await buildServerMap(electronApp);
            const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
            const firstServerId = serverMap[demoMattermostConfig.servers[0].name][0].webContentsId;
            await loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchFormContainer');

            await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+=`);
            const zoomLevel = await browserWindow.evaluate((window, id) => (window as any).contentView.children.find((view: any) => view.webContents.id === id).webContents.getZoomFactor(), firstServerId);
            expect(zoomLevel).toBeGreaterThan(1);
            expect(zoomLevel).toBeLessThan(1.5);
        });

        test('MM-T818_2 Zoom in when CmdOrCtrl+Shift+Plus is pressed', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const browserWindow = await electronApp.browserWindow(mainWindow);
            const serverMap = await buildServerMap(electronApp);
            const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
            const firstServerId = serverMap[demoMattermostConfig.servers[0].name][0].webContentsId;
            await loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchFormContainer');

            // reset zoom
            await setZoomFactorOfServer(browserWindow, firstServerId, 1);
            const initialZoom = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(initialZoom).toBe(1);

            await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+Shift+=`);
            const zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(zoomLevel).toBeGreaterThan(1);
        });
    });

    test.describe('MM-T819 Zoom out from the menu bar', () => {
        test('MM-T819_1 Zoom out when CmdOrCtrl+Minus is pressed', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const browserWindow = await electronApp.browserWindow(mainWindow);
            const serverMap = await buildServerMap(electronApp);
            const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
            const firstServerId = serverMap[demoMattermostConfig.servers[0].name][0].webContentsId;
            await loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchFormContainer');

            await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+-`);
            const zoomLevel = await browserWindow.evaluate((window, id) => (window as any).contentView.children.find((view: any) => view.webContents.id === id).webContents.getZoomFactor(), firstServerId);
            expect(zoomLevel).toBeLessThan(1);
        });

        test('MM-T819_2 Zoom out when CmdOrCtrl+Shift+Minus is pressed', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const browserWindow = await electronApp.browserWindow(mainWindow);
            const serverMap = await buildServerMap(electronApp);
            const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
            const firstServerId = serverMap[demoMattermostConfig.servers[0].name][0].webContentsId;
            await loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchFormContainer');

            // reset zoom
            await setZoomFactorOfServer(browserWindow, firstServerId, 1.0);
            const initialZoom = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(initialZoom).toBe(1);

            await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+Shift+-`);
            const zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(zoomLevel).toBeLessThan(1);
        });
    });

    test.describe('Reload', () => {
        test('MM-T814 should reload page when pressing Ctrl+R', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const browserWindow = await electronApp.browserWindow(mainWindow);
            const serverMap = await buildServerMap(electronApp);
            const webContentsId = serverMap[demoMattermostConfig.servers[0].name][0].webContentsId;

            const checkPromise = browserWindow.evaluate((window, id) => {
                return new Promise<boolean>((resolve) => {
                    const browserView = (window as any).contentView.children.find((view: any) => view.webContents.id === id);
                    browserView.webContents.on('did-finish-load', () => {
                        resolve(true);
                    });
                });
            }, webContentsId);

            await mainWindow.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+r`);
            const result = await checkPromise;
            expect(result).toBe(true);
        });

        test('MM-T815 should reload page when pressing Ctrl+Shift+R', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const browserWindow = await electronApp.browserWindow(mainWindow);
            const serverMap = await buildServerMap(electronApp);
            const webContentsId = serverMap[demoMattermostConfig.servers[0].name][0].webContentsId;

            const checkPromise = browserWindow.evaluate((window, id) => {
                return new Promise<boolean>((resolve) => {
                    const browserView = (window as any).contentView.children.find((view: any) => view.webContents.id === id);
                    browserView.webContents.on('did-finish-load', () => {
                        resolve(true);
                    });
                });
            }, webContentsId);

            await mainWindow.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+Shift+r`);
            const result = await checkPromise;
            expect(result).toBe(true);
        });
    });

    test('MM-T820 should open Developer Tools For Application Wrapper for main window', {tag: ['@P2', '@darwin', '@win32']}, async ({electronApp, mainWindow}) => {
        if (process.platform === 'linux') {
            test.skip(true, 'Linux not supported');
            return;
        }

        const browserWindow = await electronApp.browserWindow(mainWindow);

        let isDevToolsOpen = await browserWindow.evaluate((window) => {
            return (window as any).webContents.isDevToolsOpened();
        });
        expect(isDevToolsOpen).toBe(false);

        if (process.platform === 'darwin') {
            await mainWindow.keyboard.press('Meta+Alt+i');
        } else if (process.platform === 'win32') {
            await mainWindow.keyboard.press('Control+Shift+i');
        }

        isDevToolsOpen = await browserWindow.evaluate((window) => {
            return (window as any).webContents.isDevToolsOpened();
        });
        expect(isDevToolsOpen).toBe(true);
    });
});
