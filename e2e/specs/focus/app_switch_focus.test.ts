// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

// ── MM-T1311: Switch applications: Text input is focused ──────────────
// When the user switches away from the Desktop App (Cmd+Tab on macOS,
// Alt+Tab on Windows) and returns, the text input in the server view
// must retain focus. This is a desktop-specific focus management concern.
//
// Related: focus.test.ts (MM-T1315, MM-T1316, MM-T1317) tests focus
// after closing modals and switching servers. This test covers the
// application-switch scenario.

test.describe('focus/app_switch', () => {
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

    test('MM-T1311 Switch applications: Text input is focused within server view (webview)',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            // Focus the post textbox
            await firstServer!.waitForSelector('#post_textbox', {timeout: 10_000});
            await firstServer!.focus('#post_textbox');

            // Verify textbox is focused
            const initiallyFocused = await firstServer!.evaluate(() => {
                const textbox = document.querySelector('#post_textbox');
                return textbox === document.activeElement;
            });
            expect(initiallyFocused, 'Post textbox must be focused initially').toBe(true);

            // Simulate switching away: hide the main window (app goes to background)
            await electronApp.evaluate(({BrowserWindow}) => {
                const mainWin = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
                mainWin?.hide();
            });

            // Simulate switching back: show and focus the main window
            await electronApp.evaluate(({BrowserWindow}) => {
                const mainWin = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
                if (mainWin) {
                    mainWin.show();
                    mainWin.focus();
                }
            });

            // Wait for the window to be visible again
            await expect.poll(
                () => electronApp.evaluate(({BrowserWindow}) =>
                    BrowserWindow.getAllWindows().some((w) => w.isVisible()),
                ),
                {timeout: 10_000, message: 'Main window must be visible after switching back'},
            ).toBe(true);

            // Verify the textbox is still focused after switching back
            await expect.poll(
                () => firstServer!.evaluate(() => {
                    const textbox = document.querySelector('#post_textbox');
                    return textbox === document.activeElement;
                }),
                {timeout: 10_000, message: 'Post textbox must retain focus after app switch'},
            ).toBe(true);
        },
    );
});
