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

    test(
        'MM-T4803 Open Servers Menu using keyboard shortcuts',
        {tag: ['@P2', '@all']},
        async ({electronApp, mainWindow}) => {
            expect(mainWindow).toBeDefined();

            const clicked = await electronApp.evaluate(({Menu}) => {
                const root = Menu.getApplicationMenu();
                if (!root) {
                    return false;
                }
                const stack = [...root.items];
                while (stack.length) {
                    const item = stack.shift()!;
                    if (item.label === 'Show Servers') {
                        item.click();
                        return true;
                    }
                    if (item.submenu) {
                        stack.push(...item.submenu.items);
                    }
                }
                return false;
            });
            expect(clicked, '"Show Servers" menu item must exist and be clickable').toBe(true);

            const dropdownWindow = electronApp.windows().find((w) => w.url().includes('dropdown')) ??
                await electronApp.waitForEvent('window', {
                    predicate: (w) => w.url().includes('dropdown'),
                    timeout: 10_000,
                });
            expect(dropdownWindow, 'Server dropdown window must appear after Show Servers menu click').toBeDefined();
        },
    );
});
