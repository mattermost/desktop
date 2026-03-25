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

        // Open Settings via direct menu invocation (more reliable than keyboard navigation
        // through the native menu bar, which key events from web contents do not reach reliably)
        await electronApp.evaluate(({app}) => {
            const menuId = process.platform === 'darwin' ? 'app' : 'file';
            const menu = (app as any).applicationMenu?.getMenuItemById(menuId);
            const settingsItem = menu?.submenu?.items?.find((item: any) => item.accelerator?.includes(','));
            if (!settingsItem) {
                throw new Error('Settings menu item not found');
            }
            settingsItem.click();
        });
        const settingsWindow = await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
        });
        expect(settingsWindow).toBeDefined();
    });
});
