// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

test.describe('menu/menu', () => {
    test('MM-T4404 should open the 3 dot menu with Alt', {tag: ['@P2', '@win32']}, async ({electronApp, mainWindow}) => {
        if (process.platform === 'darwin') {
            test.skip(true, 'No keyboard shortcut for macOS');
            return;
        }

        expect(mainWindow).toBeDefined();

        await mainWindow.waitForSelector('button.three-dot-menu');

        // Settings window should open if Alt works
        await mainWindow.keyboard.press('Alt');
        await mainWindow.keyboard.press('Enter');
        await mainWindow.keyboard.press('f');
        await mainWindow.keyboard.press('s');
        await mainWindow.keyboard.press('Enter');
        const settingsWindow = await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
        });
        expect(settingsWindow).toBeDefined();
    });
});
