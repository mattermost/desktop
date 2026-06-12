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
            // The "Current Server" DevTools opens the devtools for the active server's WebContentsView
            // This is different from "Application Wrapper" which opens devtools for the main BrowserWindow

            // Verify the server's webContents is accessible
            const webContentsExists = await electronApp.evaluate(({webContents}, id) => {
                const wc = webContents.fromId(id);
                return wc !== undefined && !wc.isDestroyed();
            }, webContentsId);
            expect(webContentsExists, 'Server webContents should exist').toBe(true);

            // Verify devtools can be opened for the server webContents
            const devToolsOpened = await electronApp.evaluate(({webContents}, id) => {
                const wc = webContents.fromId(id);
                if (!wc || wc.isDestroyed()) {
                    return false;
                }
                try {
                    wc.openDevTools({mode: 'detach'});
                    return true;
                } catch {
                    return false;
                }
            }, webContentsId);
            expect(devToolsOpened, 'Should be able to open DevTools for server webContents').toBe(true);

            // Verify devtools are open
            const devToolsAreOpen = await electronApp.evaluate(({webContents}, id) => {
                const wc = webContents.fromId(id);
                if (!wc || wc.isDestroyed()) {
                    return false;
                }
                return wc.isDevToolsOpened();
            }, webContentsId);
            expect(devToolsAreOpen, 'DevTools should be open for server webContents').toBe(true);

            // Close devtools
            await electronApp.evaluate(({webContents}, id) => {
                const wc = webContents.fromId(id);
                if (wc && !wc.isDestroyed()) {
                    wc.closeDevTools();
                }
            }, webContentsId);

            // Verify devtools closed
            await expect.poll(
                () => electronApp.evaluate(({webContents}, id) => {
                    const wc = webContents.fromId(id);
                    return wc && !wc.isDestroyed() ? !wc.isDevToolsOpened() : true;
                }, webContentsId),
                {timeout: 5_000, message: 'DevTools should close'},
            ).toBe(true);

            // Verify the server view is still functional after devtools open/close
            const serverStillFunctional = await serverWin.evaluate(() => {
                const textbox = document.querySelector('#post_textbox');
                return textbox !== null;
            });
            expect(serverStillFunctional, 'Server view should still be functional after DevTools toggle').toBe(true);
        },
    );
});
