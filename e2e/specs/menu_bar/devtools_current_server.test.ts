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
import {clickApplicationMenuItem} from '../../helpers/menu';
import {getActiveServerWebContentsId} from '../../helpers/testRefs';

test.describe('menu_bar/devtools_current_server', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('MM-T821 Toggle Developer Tools for Current Server in the Menu Bar',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Mattermost server view should exist').toBeTruthy();

            await loginToMattermost(firstServer!);
            await firstServer!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

            const webContentsId = await getActiveServerWebContentsId(electronApp);

            const webContentsExists = await electronApp.evaluate(({webContents}, id) => {
                const wc = webContents.fromId(id);
                return wc !== undefined && !wc.isDestroyed();
            }, webContentsId);
            expect(webContentsExists, 'Server webContents should exist').toBe(true);

            await clickApplicationMenuItem(
                electronApp,
                'view',
                {label: 'Developer Tools for Current Tab'},
                {webContentsId},
            );
            await expect.poll(
                () => electronApp.evaluate(({webContents}, id) => {
                    const wc = webContents.fromId(id);
                    return Boolean(wc && !wc.isDestroyed() && wc.isDevToolsOpened());
                }, webContentsId),
                {timeout: 15_000, message: 'DevTools must open for the current server webContents after menu click'},
            ).toBe(true);

            // The View menu item calls openDevTools() (not toggle). Close explicitly.
            await electronApp.evaluate(({webContents}, id) => {
                const wc = webContents.fromId(id);
                wc?.closeDevTools();
            }, webContentsId);
            await expect.poll(
                () => electronApp.evaluate(({webContents}, id) => {
                    const wc = webContents.fromId(id);
                    return wc && !wc.isDestroyed() ? !wc.isDevToolsOpened() : true;
                }, webContentsId),
                {timeout: 15_000, message: 'DevTools must close after closeDevTools()'},
            ).toBe(true);

            const serverStillFunctional = await firstServer!.evaluate(() => {
                return document.querySelector('#post_textbox') !== null;
            });
            expect(serverStillFunctional, 'Server view should still be functional after DevTools toggle').toBe(true);
        },
    );
});
