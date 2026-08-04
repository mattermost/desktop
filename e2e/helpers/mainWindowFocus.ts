// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication, Page} from 'playwright';

import {getMainWindowId} from './testRefs';

export async function focusMainBrowserWindow(app: ElectronApplication, mainWindow: Page): Promise<void> {
    await app.evaluate(({app: electronApp}) => {
        const refs = (global as any).__e2eTestRefs;
        const win = refs?.MainWindow?.get?.();
        if (!win || win.isDestroyed()) {
            return false;
        }
        if (process.platform === 'darwin') {
            electronApp.show();
        }
        if (win.isMinimized()) {
            win.restore();
        }
        win.show();
        win.focus();
        return true;
    });
    await mainWindow.bringToFront().catch(() => {});
    await mainWindow.click('#newTabButton').catch(async () => {
        await mainWindow.click('.ServerDropdownButton').catch(async () => {
            await mainWindow.click('body', {position: {x: 24, y: 24}});
        });
    });
}

export async function isMainWindowFocused(app: ElectronApplication): Promise<boolean> {
    const mainWindowId = await getMainWindowId(app);
    return app.evaluate(({BrowserWindow}, id) => {
        const win = BrowserWindow.fromId(id);
        const focused = BrowserWindow.getFocusedWindow();
        return Boolean(
            win &&
            !win.isDestroyed() &&
            (win.isFocused() || focused?.id === win.id),
        );
    }, mainWindowId);
}

export async function waitForMainWindowFocused(
    app: ElectronApplication,
    mainWindow: Page,
    timeoutMs = 15_000,
    message = 'Main window must receive OS focus',
): Promise<void> {
    await expect.poll(async () => {
        if (await isMainWindowFocused(app)) {
            return true;
        }
        await focusMainBrowserWindow(app, mainWindow);
        return isMainWindowFocused(app);
    }, {timeout: timeoutMs, message}).toBe(true);
}
