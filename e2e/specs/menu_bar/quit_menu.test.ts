// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {isTransientEvaluateError} from '../../helpers/testRefs';

async function clickQuitRole(electronApp: ElectronApplication) {
    const menuId = process.platform === 'darwin' ? 'app' : 'file';

    const quitExists = await electronApp.evaluate(({app, Menu}) => {
        const rootMenu = app.applicationMenu ?? Menu.getApplicationMenu();
        const hasQuit = (items: Electron.MenuItem[]): boolean => {
            return items.some((item) => item.role === 'quit' || (item.submenu?.items?.length && hasQuit(item.submenu.items)));
        };
        return hasQuit(rootMenu?.items ?? []);
    });
    expect(quitExists, 'Application menu must expose a Quit item').toBe(true);

    await electronApp.evaluate(({app, Menu, BrowserWindow}, id) => {
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

        const topLevel = rootMenu?.getMenuItemById(id);
        const searchItems = topLevel?.submenu?.items ?? rootMenu?.items ?? [];
        if (!clickQuit(searchItems) && !clickQuit(rootMenu?.items ?? [])) {
            throw new Error('Quit menu item not found');
        }
    }, menuId);
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
            // item.click({role:'quit'}) often never returns because the main
            // process exits mid-evaluate. Race the click with close so Linux CI
            // cannot burn the 90s test timeout and then workerTeardownTimeout.
            const closePromise = waitForAppClose(electronApp, 20_000);
            try {
                await Promise.race([clickQuitRole(electronApp), closePromise]);
            } catch (error) {
                if (!isTransientEvaluateError(error)) {
                    throw error;
                }
            }

            let closed = await closePromise;
            if (!closed && process.platform === 'darwin') {
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
