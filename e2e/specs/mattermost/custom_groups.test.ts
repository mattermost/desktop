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

const USER_GROUPS_MENU_ITEM = '#userGroups, #userGroups-button';

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
                await firstServer!.waitForSelector(
                    `${USER_GROUPS_MENU_ITEM}, .product-switcher-menu button, .Menu .MenuItem`,
                    {timeout: 5_000},
                );
            } catch {
                await firstServer!.keyboard.press('Escape');
                test.skip(true, 'User Groups not available in product menu');
                return;
            }

            const userGroupsDisabled = await firstServer!.evaluate(() => {
                const btn = document.querySelector('#userGroups-button, #userGroups button');
                return btn instanceof HTMLButtonElement && Boolean(btn.disabled || btn.classList.contains('disabled'));
            });
            if (userGroupsDisabled) {
                await firstServer!.keyboard.press('Escape');
                test.skip(true, 'User Groups is license-disabled on this server');
                return;
            }

            // 10.11 Menu.ItemToggleModalRedux: id="userGroups" on the <li>,
            // ToggleModalButton id="userGroups-button". 12.0 keeps the li id and
            // puts React onClick on the inner button (clicking the li is a no-op).
            const groupsClicked = await firstServer!.evaluate(() => {
                const click = (el: Element | null) => {
                    if (!(el instanceof HTMLElement)) {
                        return false;
                    }
                    if (el instanceof HTMLButtonElement && el.disabled) {
                        return false;
                    }
                    el.click();
                    return true;
                };
                if (click(document.querySelector('#userGroups-button'))) {
                    return true;
                }
                const byId = document.querySelector('#userGroups');
                if (byId) {
                    const inner = byId.querySelector('button:not([disabled]), a');
                    if (click(inner) || click(byId)) {
                        return true;
                    }
                }
                const items = document.querySelectorAll(
                    '.product-switcher-menu button, .Menu .MenuItem button, .Menu .MenuItem, [role="menuitem"]',
                );
                const groupsItem = Array.from(items).find((item) => {
                    const text = (item.textContent ?? '').trim().toLowerCase();
                    return text === 'user groups' || text.startsWith('user groups');
                });
                return click(groupsItem ?? null);
            });
            expect(groupsClicked, 'User Groups menu item must be clickable').toBe(true);

            await expect.poll(
                () => firstServer!.evaluate((selector) => {
                    const roots = Array.from(document.querySelectorAll(selector));
                    for (const root of roots) {
                        if (root.closest('.product-switcher-menu')) {
                            continue;
                        }
                        if (root.querySelector('.user-groups-list, ul, ol, table, [role="list"], [role="table"], [role="grid"]')) {
                            return true;
                        }
                        const text = (root.textContent ?? '').toLowerCase();
                        if (text.includes('user groups') || text.includes('no groups') || text.includes('create group')) {
                            return true;
                        }
                    }
                    return window.location.pathname.includes('user_groups') ||
                        window.location.pathname.includes('user-groups');
                }, USER_GROUPS_SURFACE),
                {timeout: 10_000, message: 'User Groups view must show a list, empty state, or header'},
            ).toBe(true);

            await firstServer!.click('#sidebarItem_town-square');
            await firstServer!.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
        },
    );
});
