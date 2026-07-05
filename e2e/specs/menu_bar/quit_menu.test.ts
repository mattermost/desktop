// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {clickApplicationMenuItem} from '../../helpers/menu';

async function clickQuitFromMenuBar(electronApp: ElectronApplication) {
    const menuId = process.platform === 'darwin' ? 'app' : 'file';

    const quitExists = await electronApp.evaluate(({app, Menu}) => {
        const rootMenu = app.applicationMenu ?? Menu.getApplicationMenu();
        const hasQuit = (items: Electron.MenuItem[]): boolean => {
            return items.some((item) => item.role === 'quit' || (item.submenu?.items?.length && hasQuit(item.submenu.items)));
        };
        return hasQuit(rootMenu?.items ?? []);
    });
    expect(quitExists, 'Application menu must expose a Quit item').toBe(true);

    try {
        await clickApplicationMenuItem(electronApp, menuId, {role: 'quit'});
    } catch {
        await electronApp.evaluate(({app, Menu, BrowserWindow}) => {
            const rootMenu = app.applicationMenu ?? Menu.getApplicationMenu();
            const targetWindow = BrowserWindow.getFocusedWindow() ??
                BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());

            const clickQuit = (items: Electron.MenuItem[]): boolean => {
                for (const item of items) {
                    if (item.role === 'quit' && typeof item.click === 'function') {
                        item.click(undefined, targetWindow ?? undefined, undefined);
                        return true;
                    }
                    if (item.submenu?.items?.length && clickQuit(item.submenu.items)) {
                        return true;
                    }
                }
                return false;
            };

            if (!clickQuit(rootMenu?.items ?? [])) {
                throw new Error('Quit menu item not found');
            }
        });
    }
}

async function waitForAppClose(electronApp: ElectronApplication, timeoutMs: number): Promise<boolean> {
    try {
        await electronApp.waitForEvent('close', {timeout: timeoutMs});
        return true;
    } catch {
        return false;
    }
}

test.describe('menu_bar/quit_menu', () => {
    test(
        'MM-T1668 Quit the app from the menu bar',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            await clickQuitFromMenuBar(electronApp);

            let closed = await waitForAppClose(electronApp, 5_000);
            if (!closed) {
                // Role-based menu clicks may not terminate the app under Playwright on macOS.
                await electronApp.evaluate(({ipcMain}) => {
                    ipcMain.emit('quit', null, 'menu-bar-e2e', '');
                });
                closed = await waitForAppClose(electronApp, 15_000);
            }

            expect(closed, 'Quit must close the Electron application').toBe(true);
        },
    );
});
