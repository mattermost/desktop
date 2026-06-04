// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

test.describe('menu/view', () => {
    test.use({appConfig: demoMattermostConfig});

    test('MM-T816 Toggle Full Screen in the Menu Bar', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows only');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverMap = await buildServerMap(electronApp);
        const serverName = demoMattermostConfig.servers[0].name;
        const serverEntry = serverMap[serverName]?.[0];
        if (!serverEntry) {
            test.skip(true, `Server "${serverName}" not found in serverMap`);
            return;
        }
        const firstServer = serverEntry.win;
        await loginToMattermost(firstServer);
        await firstServer.waitForSelector('#post_textbox');

        // Assert on the main window's fullscreen STATE rather than the embedded server
        // view's window.outerWidth/Height. On a fixed-resolution CI display (the Windows
        // runner is 1024 wide, matching DEFAULT_WINDOW_WIDTH) the windowed and fullscreen
        // widths are identical, so a "fullscreen > windowed" dimension check is a false
        // negative. isFullScreen() reflects exactly what the menu item toggles.
        const isMainWindowFullScreen = () => electronApp.evaluate(({BrowserWindow}) => {
            const refs = (global as any).__e2eTestRefs;
            const win = refs?.MainWindow?.get?.() ?? BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
            return Boolean(win && win.isFullScreen());
        });
        expect(await isMainWindowFullScreen()).toBe(false);

        // Use direct menu invocation — keyboard events sent via Playwright CDP to the
        // web contents do not reliably reach the native Electron popup menu on Windows.
        // Pass the main window to item.click() so the role-based 'togglefullscreen'
        // action knows which window to target (getFocusedWindow() may be null in
        // headless CI).
        await electronApp.evaluate(({app, BrowserWindow}) => {
            const viewMenu = (app as any).applicationMenu?.getMenuItemById('view');
            const toggleItem = viewMenu?.submenu?.items?.find(
                (item: any) => item.role === 'togglefullscreen' || item.accelerator === 'F11',
            );
            if (!toggleItem) {
                throw new Error('Toggle Full Screen menu item not found');
            }
            const refs = (global as any).__e2eTestRefs;
            const targetWindow = BrowserWindow.getFocusedWindow() ??
                refs?.MainWindow?.get?.() ??
                BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ??
                null;
            toggleItem.click(undefined, targetWindow, undefined);
        });

        await electronApp.evaluate(async ({BrowserWindow}) => {
            const refs = (global as any).__e2eTestRefs;
            const win = refs?.MainWindow?.get?.() ?? BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
            if (!win) {
                throw new Error('Main window not found');
            }
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timed out waiting for fullscreen')), 15000);
                if (win.isFullScreen()) {
                    clearTimeout(timeout);
                    resolve();
                    return;
                }
                win.once('enter-full-screen', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
        });

        expect(await isMainWindowFullScreen()).toBe(true);

        await electronApp.evaluate(({app, BrowserWindow}) => {
            const viewMenu = (app as any).applicationMenu?.getMenuItemById('view');
            const toggleItem = viewMenu?.submenu?.items?.find(
                (item: any) => item.role === 'togglefullscreen' || item.accelerator === 'F11',
            );
            if (!toggleItem) {
                throw new Error('exit fullscreen menu item not found');
            }
            const refs = (global as any).__e2eTestRefs;
            const targetWindow = BrowserWindow.getFocusedWindow() ??
                refs?.MainWindow?.get?.() ??
                BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ??
                null;
            toggleItem.click(undefined, targetWindow, undefined);
        });

        await electronApp.evaluate(async ({BrowserWindow}) => {
            const refs = (global as any).__e2eTestRefs;
            const win = refs?.MainWindow?.get?.() ?? BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
            if (!win) {
                throw new Error('Main window not found');
            }
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timed out waiting for exit fullscreen')), 15000);
                if (!win.isFullScreen()) {
                    clearTimeout(timeout);
                    resolve();
                    return;
                }
                win.once('leave-full-screen', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
        });

        expect(await isMainWindowFullScreen()).toBe(false);
    });
});
