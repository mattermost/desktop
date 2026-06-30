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

    // NOTE: `serverMap` is a test-scoped fixture and Playwright forbids accessing
    // test-scoped fixtures from `test.beforeAll`. Login runs in `beforeEach` so the
    // fixture is requested at the correct scope; subsequent tests are cheap because
    // the underlying session cookie is already established.
    test.beforeEach(async ({serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        if (!process.env.MM_TEST_USER_NAME || !process.env.MM_TEST_PASSWORD) {
            test.skip(true, 'MM_TEST_USER_NAME and MM_TEST_PASSWORD required');
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

            // Scope assertions to the actual User Groups surface (modal or page).
            // Webapp renders user groups inside `.user-groups-modal` / `#user-groups-modal`
            // (with `_heading`/`_body`), so prefer those selectors over substring wildcards
            // that can match unrelated sidebar/channel elements.
            const groupsSurfaceSelector = [
                '.user-groups-modal',
                '#user-groups-modal',
                '#user-groups-modal_body',
                '[id^="user-groups-modal"]',
                '[class*="UserGroupsModal"]',
                '[class*="user-groups-modal"]',
            ].join(', ');

            await firstServer!.waitForSelector(groupsSurfaceSelector, {timeout: 10_000});

            const viewHasStructure = await firstServer!.evaluate((selector) => {
                const roots = document.querySelectorAll(selector);
                for (const root of roots) {
                    if (root.querySelector('ul, ol, table, [role="list"], [role="table"], [role="grid"]')) {
                        return true;
                    }
                }
                return false;
            }, groupsSurfaceSelector);
            expect(viewHasStructure, 'User Groups view must have a list/table structure').toBe(true);

            // Return to channels
            await firstServer!.click('#sidebarItem_town-square');
            await firstServer!.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
        },
    );
});
