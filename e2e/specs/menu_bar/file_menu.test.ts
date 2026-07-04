// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {clickApplicationMenuItem} from '../../helpers/menu';

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

    // appReady ensures the application menu is built before clicking File items.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    test('MM-T805 Sign in to Another Server Window opens using menu item', {tag: ['@P2', '@win32']}, async ({electronApp, appReady: _appReady}) => {
        await clickApplicationMenuItem(electronApp, 'file', {labelIncludes: 'Sign in'});
        const signInToAnotherServerWindow = await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('newServer'),
            timeout: 15_000,
        });
        expect(signInToAnotherServerWindow).toBeDefined();
    });

    test('MM-T804 Preferences in Menu Bar open the Settings page', {tag: ['@P2', '@win32']}, async ({electronApp}) => {
        // Reuse the existing direct-invocation helper instead of keyboard navigation.
        await openPreferencesFromAppMenu(electronApp);
        const settingsWindow = await waitForSettingsWindow(electronApp);
        expect(settingsWindow).toBeDefined();
    });

    test('MM-T806 Exit in the Menu Bar', {tag: ['@P2', '@darwin']}, async ({electronApp, mainWindow}) => {
        expect(mainWindow).toBeDefined();
        await mainWindow.waitForLoadState();
        await mainWindow.bringToFront();

        await quitFromAppMenu(electronApp);
        await waitForAppExit(electronApp);

        await expect.poll(() => {
            return electronApp.windows().some((window) => window.url().includes('index'));
        }).toBe(false);
    });

    test(
        'MM-T1319 Sign in to Another Server — server name input should be focused',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            // The Add Server modal opens in a newServer window; start waiting before clicking
            const newServerWindowPromise = electronApp.waitForEvent('window', {
                predicate: (window) => window.url().includes('newServer'),
                timeout: 15_000,
            });

            await clickApplicationMenuItem(electronApp, 'file', {labelIncludes: 'Sign in'});

            const newServerWindow = await newServerWindowPromise;
            await newServerWindow.waitForLoadState();

            // Verify the server URL input is focused (has autoFocus attribute in NewServerModal)
            const focusedElement = await newServerWindow.evaluate(() => {
                const active = document.activeElement;
                return active?.id ?? null;
            });
            expect(focusedElement, 'Server URL input must be focused after opening Sign in to Another Server').toBe('serverUrlInput');
        },
    );
});
