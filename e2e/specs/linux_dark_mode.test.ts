// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../fixtures/index';

async function toggleDarkMode(page: import('playwright').Page) {
    await page.keyboard.press('Alt');
    await page.keyboard.press('Enter');
    await page.keyboard.press('v');
    await page.keyboard.press('t');
    await new Promise((resolve) => setTimeout(resolve, 500)); // sometimes the second 't' doesn't fire
    await page.keyboard.press('t'); // Click on "Toggle Dark Mode" menu item
    await page.keyboard.press('Enter');
}

test.describe('dark_mode', () => {
    test('MM-T2465 Linux Dark Mode Toggle', {tag: ['@P2', '@linux']}, async ({electronApp, mainWindow}) => {
        if (process.platform !== 'linux') {
            test.skip(true, 'Linux only');
            return;
        }

        expect(mainWindow).not.toBeNull();

        // Toggle Dark Mode
        await toggleDarkMode(mainWindow);

        // Wait for dark mode class to be applied
        // Linux needs more time for dark mode to propagate through the window manager
        await mainWindow.waitForSelector('.topBar.darkMode', {timeout: 10000});

        const topBarElementWithDarkMode = await mainWindow.waitForSelector('.topBar');
        const topBarElementClassWithDarkMode = await topBarElementWithDarkMode.getAttribute('class');

        expect(topBarElementClassWithDarkMode).toContain('darkMode');

        // Toggle Light Mode
        await toggleDarkMode(mainWindow);

        // Wait for dark mode class to be removed
        await mainWindow.waitForSelector('.topBar:not(.darkMode)', {timeout: 10000});

        const topBarElementWithLightMode = await mainWindow.waitForSelector('.topBar');
        const topBarElementClassWithLightMode = await topBarElementWithLightMode.getAttribute('class');

        expect(topBarElementClassWithLightMode).not.toContain('darkMode');
    });
});
