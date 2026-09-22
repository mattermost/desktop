// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {waitForMattermostShellReady} from '../../helpers/mattermostShell';

// ── MM-T5584: Viewing Custom Groups ───────────────────────────────────
// Custom Groups (User Groups) are an Enterprise feature. The desktop app
// hosts the webapp UI; availability is gated by the server license.
// 12.0 Products menu uses #product_switch_menu and #userGroups (not the
// pre-12 #product_switcher / .product-switcher-menu selectors).

const PRODUCT_MENU_BUTTON = [
    '#product_switch_menu',
    '#product_switcher',
    'button[aria-label="Product switch menu"]',
].join(', ');

const USER_GROUPS_MENU_ITEM = '#userGroups';

const USER_GROUPS_SURFACE = [
    '#userGroupsModal',
    '.user-groups-modal',
    '#user-groups-modal',
    '#user-groups-modal_body',
    '[id^="user-groups-modal"]',
    '[class*="UserGroupsModal"]',
    '[class*="user-groups-modal"]',
].join(', ');

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
        await waitForMattermostShellReady(firstServer!, {channelItem: '#sidebarItem_town-square'});
    });

    test('MM-T5584 Viewing Custom Groups',
        {tag: ['@P2', '@all']},
        async ({serverMap}) => {
            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            try {
                await firstServer!.waitForSelector(PRODUCT_MENU_BUTTON, {timeout: 10_000});
            } catch {
                test.skip(true, 'Product menu not available — may require Enterprise license');
                return;
            }

            await firstServer!.click(PRODUCT_MENU_BUTTON);

            try {
                await firstServer!.waitForSelector(USER_GROUPS_MENU_ITEM, {timeout: 5_000});
            } catch {
                await firstServer!.keyboard.press('Escape');
                test.skip(true, 'User Groups not available in product menu');
                return;
            }

            // Menu.ItemToggleModalRedux puts id="userGroups" on the <li>; the
            // React onClick lives on the inner button. ServerLocator.click()
            // dispatches element.click() on the li, which does not fire it.
            const groupsClicked = await firstServer!.evaluate(() => {
                const item = document.querySelector('#userGroups') as HTMLElement | null;
                if (!item) {
                    return false;
                }
                const target = (item.querySelector('button, a, [role="menuitem"]') as HTMLElement | null) ?? item;
                target.click();
                return true;
            });
            expect(groupsClicked, 'User Groups menu item must be clickable').toBe(true);

            await firstServer!.waitForSelector(USER_GROUPS_SURFACE, {timeout: 10_000});

            const viewHasStructure = await firstServer!.evaluate((selector) => {
                const roots = document.querySelectorAll(selector);
                for (const root of roots) {
                    if (root.querySelector('.user-groups-list, ul, ol, table, [role="list"], [role="table"], [role="grid"]')) {
                        return true;
                    }
                    const text = (root.textContent ?? '').toLowerCase();
                    if (text.includes('user groups') || text.includes('no groups')) {
                        return true;
                    }
                }
                return false;
            }, USER_GROUPS_SURFACE);
            expect(viewHasStructure, 'User Groups view must show a list, empty state, or header').toBe(true);

            await firstServer!.click('#sidebarItem_town-square');
            await firstServer!.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
        },
    );
});
