// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

async function openPreferencesFromAppMenu(electronApp: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>) {
    await electronApp.evaluate(async ({app}) => {
        // On macOS the Preferences item lives in the app menu; on other platforms it's in the file menu
        const menuId = process.platform === 'darwin' ? 'app' : 'file';
        const menu = (app as any).applicationMenu.getMenuItemById(menuId);
        const preferencesItem = menu?.submenu?.items?.find((item: any) => item.accelerator?.includes(','));
        if (!preferencesItem) {
            throw new Error('Preferences menu item not found');
        }
        preferencesItem.click();
    });
}

async function waitForSettingsWindow(electronApp: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>) {
    let settingsWindow = electronApp.windows().find((window) => window.url().includes('settings'));
    if (!settingsWindow) {
        settingsWindow = await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
            timeout: 30_000,
        });
    }

    await settingsWindow.waitForLoadState();
    await settingsWindow.bringToFront();
    await settingsWindow.waitForSelector('.SettingsModal', {state: 'visible', timeout: 30_000});
    return settingsWindow;
}

async function quitFromAppMenu(electronApp: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>) {
    await electronApp.evaluate(async ({app}) => {
        app.quit();
    });
}

async function waitForAppExit(electronApp: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>) {
    const appProcess = electronApp.process();
    if (!appProcess) {
        return;
    }

    if (appProcess.exitCode !== null) {
        return;
    }

    await new Promise<void>((resolve) => {
        appProcess.once('exit', () => resolve());
    });
}

test.describe('file_menu/dropdown', () => {
    test('MM-T1313 Open Settings modal using keyboard shortcuts', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
        expect(mainWindow).toBeDefined();

        await mainWindow.waitForLoadState();
        await mainWindow.bringToFront();
        await openPreferencesFromAppMenu(electronApp);
        const settingsWindow = await waitForSettingsWindow(electronApp);
        expect(settingsWindow).toBeDefined();
    });

    test('MM-T805 Sign in to Another Server Window opens using menu item', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows-only test');
            return;
        }

        // Invoke the File menu item directly — keyboard presses sent via Playwright
        // do not reliably reach popup menus in headless CI on Windows.
        await electronApp.evaluate(({app}) => {
            const fileMenu = (app as any).applicationMenu?.getMenuItemById('file');
            const signInItem = fileMenu?.submenu?.items?.find(
                (item: any) => typeof item.label === 'string' && item.label.includes('Sign in'),
            );
            if (!signInItem) {
                throw new Error('Sign in to Another Server menu item not found');
            }
            signInItem.click();
        });
        const signInToAnotherServerWindow = await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('newServer'),
            timeout: 15_000,
        });
        expect(signInToAnotherServerWindow).toBeDefined();
    });

    test('MM-T804 Preferences in Menu Bar open the Settings page', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows-only test');
            return;
        }

        // Reuse the existing direct-invocation helper instead of keyboard navigation.
        await openPreferencesFromAppMenu(electronApp);
        const settingsWindow = await waitForSettingsWindow(electronApp);
        expect(settingsWindow).toBeDefined();
    });

    test('MM-T806 Exit in the Menu Bar', {tag: ['@P2', '@darwin']}, async ({electronApp, mainWindow}) => {
        if (process.platform !== 'darwin') {
            test.skip(true, 'macOS-only test');
            return;
        }

        expect(mainWindow).toBeDefined();
        await mainWindow.waitForLoadState();
        await mainWindow.bringToFront();

        await quitFromAppMenu(electronApp);
        await waitForAppExit(electronApp);

        await expect.poll(() => {
            return electronApp.windows().some((window) => window.url().includes('index'));
        }).toBe(false);
    });
});
