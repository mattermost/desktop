// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {cmdOrCtrl} from '../../helpers/config';

test.describe('file_menu/dropdown', () => {
    test('MM-T1313 Open Settings modal using keyboard shortcuts', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
        expect(mainWindow).toBeDefined();

        await mainWindow.bringToFront();

        await mainWindow.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+,`);

        const settingsWindow = await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
        });
        expect(settingsWindow).toBeDefined();
    });

    test('MM-T805 Sign in to Another Server Window opens using menu item', {tag: ['@P2', '@win32']}, async ({electronApp, mainWindow}) => {
        if (process.platform === 'darwin') {
            test.skip(true, 'No keyboard shortcut for macOS');
            return;
        }

        expect(mainWindow).toBeDefined();
        await mainWindow.click('button.three-dot-menu');
        await mainWindow.keyboard.press('f');
        await mainWindow.keyboard.press('s');
        await mainWindow.keyboard.press('s');
        await mainWindow.keyboard.press('Enter');
        const signInToAnotherServerWindow = await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('newServer'),
        });
        expect(signInToAnotherServerWindow).toBeDefined();
    });

    test('MM-T804 Preferences in Menu Bar open the Settings page', {tag: ['@P2', '@win32']}, async ({electronApp, mainWindow}) => {
        if (process.platform === 'darwin') {
            test.skip(true, 'No keyboard shortcut for macOS');
            return;
        }

        expect(mainWindow).toBeDefined();
        await mainWindow.click('button.three-dot-menu');
        await mainWindow.keyboard.press('f');
        await mainWindow.keyboard.press('s');
        await mainWindow.keyboard.press('Enter');
        const settingsWindowFromMenu = await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
        });
        expect(settingsWindowFromMenu).toBeDefined();
    });

    test('MM-T806 Exit in the Menu Bar', {tag: ['@P2', '@darwin']}, async ({electronApp, mainWindow}) => {
        if (process.platform === 'win32') {
            test.skip(true, 'Causes issues on Windows');
            return;
        }

        expect(mainWindow).toBeDefined();

        if (process.platform === 'darwin') {
            await mainWindow.keyboard.press('Meta+q');
        } else if (process.platform === 'linux') {
            await mainWindow.keyboard.press('Control+q');
        }

        // After quit, no index window should remain
        const indexWindow = electronApp.windows().find((window) => window.url().includes('index'));
        expect(indexWindow).toBeUndefined();
    });
});
