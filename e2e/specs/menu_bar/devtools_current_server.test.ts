// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ── MM-T821: Toggle Developer Tools for Current Server ────────────────
// Tests opening DevTools for the active server's WebContentsView (the
// embedded view that renders the Mattermost webapp).
//
// Sibling test: specs/menu_bar/view_menu.test.ts :: MM-T820 tests
// DevTools for the Application Wrapper (the main BrowserWindow).
// These are distinct: MM-T820 targets the chrome window, MM-T821
// targets the server content view.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import type {ServerView} from '../../helpers/serverView';

test.describe('menu_bar/devtools_current_server', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    let serverWin: ServerView;
    let webContentsId: number;

    test.beforeAll(async ({serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
        expect(serverEntry, 'Mattermost server view should exist').toBeTruthy();
        serverWin = serverEntry!.win;
        webContentsId = serverEntry!.webContentsId;

        await loginToMattermost(serverWin);
        await serverWin.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    });

    // ── MM-T821: Toggle Developer Tools for Current Server ─────────────
    test('MM-T821 Toggle Developer Tools for Current Server in the Menu Bar',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            // Drive the actual menu item so we exercise the menu handler
            // (src/app/menus/appMenu/view.ts → TabManager.getCurrentActiveTabView().openDevTools()),
            // not the raw webContents API. Menu items in the application menu
            // don't carry ids, so we walk the tree and match the label
            // "Developer Tools for Current Tab".
            const clickMenuItem = async () => {
                const clicked = await electronApp.evaluate(({Menu}) => {
                    const root = Menu.getApplicationMenu();
                    if (!root) {
                        return false;
                    }
                    const stack = [...root.items];
                    while (stack.length) {
                        const item = stack.shift()!;
                        if (item.label === 'Developer Tools for Current Tab') {
                            item.click();
                            return true;
                        }
                        if (item.submenu) {
                            stack.push(...item.submenu.items);
                        }
                    }
                    return false;
                });
                expect(clicked, '"Developer Tools for Current Tab" menu item must exist and be clickable').toBe(true);
            };

            // Verify the server webContents exists (precondition)
            const webContentsExists = await electronApp.evaluate(({webContents}, id) => {
                const wc = webContents.fromId(id);
                return wc !== undefined && !wc.isDestroyed();
            }, webContentsId);
            expect(webContentsExists, 'Server webContents should exist').toBe(true);

            // Click the menu item — opens DevTools on the active tab view
            await clickMenuItem();
            await expect.poll(
                () => electronApp.evaluate(({webContents}, id) => {
                    const wc = webContents.fromId(id);
                    return Boolean(wc && !wc.isDestroyed() && wc.isDevToolsOpened());
                }, webContentsId),
                {timeout: 5_000, message: 'DevTools must open for the current server webContents after menu click'},
            ).toBe(true);

            // Click again to toggle DevTools closed (and confirm the menu
            // handler targets the same webContents both ways).
            await clickMenuItem();
            await expect.poll(
                () => electronApp.evaluate(({webContents}, id) => {
                    const wc = webContents.fromId(id);
                    return wc && !wc.isDestroyed() ? !wc.isDevToolsOpened() : true;
                }, webContentsId),
                {timeout: 5_000, message: 'DevTools must close on second menu click'},
            ).toBe(true);

            // The server view should still be functional after toggling DevTools
            const serverStillFunctional = await serverWin.evaluate(() => {
                const textbox = document.querySelector('#post_textbox');
                return textbox !== null;
            });
            expect(serverStillFunctional, 'Server view should still be functional after DevTools toggle').toBe(true);
        },
    );
});
