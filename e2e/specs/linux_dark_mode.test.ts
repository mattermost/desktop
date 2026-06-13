// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../fixtures/index';

async function toggleDarkModeLinux(electronApp: import('playwright').ElectronApplication) {
    await electronApp.evaluate(({Menu}) => {
        const viewMenu = Menu.getApplicationMenu()?.getMenuItemById('view');
        const darkModeItem = viewMenu?.submenu?.items?.find(
            (item) => item.label?.toLowerCase().includes('dark mode'),
        );
        if (!darkModeItem) {
            throw new Error('Toggle Dark Mode menu item not found in View menu');
        }
        darkModeItem.click();
    });
}

async function setDarkModeConfig(electronApp: import('playwright').ElectronApplication, enabled: boolean) {
    await electronApp.evaluate(({ipcMain}, darkMode: boolean) => {
        const refs = (global as any).__e2eTestRefs;
        const Config = refs?.Config;
        if (!Config) {
            return;
        }
        Config.set('darkMode', darkMode);
        ipcMain.emit('emit-configuration', null, Config.data);
    }, enabled);
}

test.describe('dark_mode', () => {
    test('MM-T2465 Linux Dark Mode Toggle', {tag: ['@P2', '@linux']}, async ({mainWindow, electronApp}) => {
        if (process.platform !== 'linux') {
            test.skip(true, 'Linux only');
            return;
        }

        expect(mainWindow).not.toBeNull();

        await toggleDarkModeLinux(electronApp);
        await mainWindow.waitForSelector('body.darkMode', {timeout: 10_000});
        expect(await mainWindow.evaluate(() => document.body.className)).toContain('darkMode');

        await toggleDarkModeLinux(electronApp);
        await mainWindow.waitForSelector('body:not(.darkMode)', {timeout: 10_000});
        expect(await mainWindow.evaluate(() => document.body.className)).not.toContain('darkMode');
    });

    test('MM-T1310 On Mac set Appearance to Dark — macOS ONLY', {tag: ['@P2', '@darwin']}, async ({mainWindow, electronApp}) => {
        if (process.platform !== 'darwin') {
            test.skip(true, 'macOS only');
            return;
        }

        expect(mainWindow).not.toBeNull();

        // macOS does not expose "Toggle Dark Mode" in the View menu (linux-only).
        // Dark mode for the application chrome is driven by Config.darkMode.
        await setDarkModeConfig(electronApp, true);
        await mainWindow.waitForSelector('body.darkMode', {timeout: 10_000});
        expect(await mainWindow.evaluate(() => document.body.className)).toContain('darkMode');

        await setDarkModeConfig(electronApp, false);
        await mainWindow.waitForSelector('body:not(.darkMode)', {timeout: 10_000});
        expect(await mainWindow.evaluate(() => document.body.className)).not.toContain('darkMode');
    });
});
