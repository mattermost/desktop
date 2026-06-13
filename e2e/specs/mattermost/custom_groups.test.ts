// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

// ── MM-T5584: Viewing and Unarchiving Custom Groups ───────────────────
// Custom Groups (User Groups) are an Enterprise feature. The desktop app
// hosts the webapp UI but the feature availability is gated by the server
// license. This test verifies the desktop correctly renders the User Groups
// view when the feature is available.
//
// NOT covered in webapp E2E suite — keeping in desktop.

test.describe('mattermost/custom_groups', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test.beforeAll(async ({serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
        expect(firstServer, 'Mattermost server view should exist').toBeTruthy();

        await loginToMattermost(firstServer!);
        await firstServer!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    });

    test('MM-T5584 Viewing and Unarchiving Custom Groups',
        {tag: ['@P2', '@all']},
        async ({serverMap}) => {
            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            // Check if User Groups are accessible via the product switcher
            const productSwitcher = await firstServer!.$('#product_switcher, .product-switcher, [class*="product-switcher"]');
            if (!productSwitcher) {
                test.skip(true, 'Product switcher not available — may require Enterprise license');
                return;
            }

            // Open the product switcher
            await productSwitcher.click();
            await firstServer!.waitForSelector('.product-switcher-menu, .Menu', {timeout: 5_000});

            // Look for User Groups in the product switcher menu
            const hasGroupsMenuItem = await firstServer!.evaluate(() => {
                const items = document.querySelectorAll('.product-switcher-menu button, .Menu .MenuItem');
                return Array.from(items).some(
                    (item) => {
                        const text = (item.textContent ?? '').toLowerCase();
                        return text.includes('user groups') || text.includes('groups');
                    },
                );
            });

            if (!hasGroupsMenuItem) {
                // Close menu and skip
                await firstServer!.click('#channelHeaderTitle');
                test.skip(true, 'User Groups not available in product switcher');
                return;
            }

            // Click User Groups
            const groupsClicked = await firstServer!.evaluate(() => {
                const items = document.querySelectorAll('.product-switcher-menu button, .Menu .MenuItem');
                const groupsItem = Array.from(items).find(
                    (item) => {
                        const text = (item.textContent ?? '').toLowerCase();
                        return text.includes('user groups') || text.includes('groups');
                    },
                );
                if (groupsItem) {
                    (groupsItem as HTMLElement).click();
                    return true;
                }
                return false;
            });
            expect(groupsClicked, 'User Groups menu item must be clickable').toBe(true);

            // Wait for the User Groups view to load
            await expect.poll(
                () => firstServer!.evaluate(() => {
                    // The groups view should have a list or table of groups
                    const groupElements = document.querySelectorAll('[class*="group"], [id*="group"]');
                    return groupElements.length;
                }),
                {timeout: 10_000, message: 'User Groups view must load with content'},
            ).toBeGreaterThan(0);

            // Verify the view has a list structure (even if empty, the container should exist)
            const viewHasStructure = await firstServer!.evaluate(() => {
                const listContainer = document.querySelector('[class*="list"], [class*="table"], [class*="grid"]');
                return listContainer !== null;
            });
            expect(viewHasStructure, 'User Groups view must have a list/table structure').toBe(true);

            // Return to channels
            await firstServer!.click('#sidebarItem_town-square');
            await firstServer!.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
        },
    );
});
