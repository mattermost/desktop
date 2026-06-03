// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../fixtures/index';

async function toggleDarkMode(electronApp: import('playwright').ElectronApplication) {
    await electronApp.evaluate(({app}) => {
        const viewMenu = (app as any).applicationMenu?.getMenuItemById('view');
        const darkModeItem = viewMenu?.submenu?.items?.find(
            (item: any) => item.label?.toLowerCase().includes('dark mode'),
        );
        if (!darkModeItem) {
            throw new Error('Toggle Dark Mode menu item not found in View menu');
        }
        darkModeItem.click();
    });
}

test.describe('dark_mode', () => {
    test('MM-T2465 Linux Dark Mode Toggle', {tag: ['@P2', '@linux']}, async ({mainWindow, electronApp}) => {
        if (process.platform !== 'linux') {
            test.skip(true, 'Linux only');
            return;
        }

        expect(mainWindow).not.toBeNull();

        // Toggle Dark Mode
        await toggleDarkMode(electronApp);

        // The darkMode class is applied to document.body, not to .topBar directly
        await mainWindow.waitForSelector('body.darkMode', {timeout: 10000});

        const bodyClassWithDarkMode = await mainWindow.evaluate(() => document.body.className);
        expect(bodyClassWithDarkMode).toContain('darkMode');

        // Toggle Light Mode
        await toggleDarkMode(electronApp);

        // Wait for dark mode class to be removed
        await mainWindow.waitForSelector('body:not(.darkMode)', {timeout: 10000});

        const bodyClassWithLightMode = await mainWindow.evaluate(() => document.body.className);
        expect(bodyClassWithLightMode).not.toContain('darkMode');
    });
});
