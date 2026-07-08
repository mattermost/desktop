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
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('MM-T1311 Switch applications: Text input is focused within server view (webview)',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            // Login + readiness — must run inside the test body because the
            // `serverMap` fixture is test-scoped and not available in beforeAll.
            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();
            await loginToMattermost(firstServer!);
            await firstServer!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

            // Focus the post textbox
            await firstServer!.waitForSelector('#post_textbox', {timeout: 10_000});
            await firstServer!.focus('#post_textbox');

            const initiallyFocused = await firstServer!.evaluate(() => {
                const textbox = document.querySelector('#post_textbox');
                return textbox === document.activeElement;
            });
            expect(initiallyFocused, 'Post textbox must be focused initially').toBe(true);

            // Resolve the main window through the same registry the rest of
            // the suite uses, so we don't blindly hide/show the wrong window
            // once a second BrowserWindow exists (e.g. Calls widget, popout).
            const mainWindowId = await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const win = refs?.MainWindow?.get?.();
                return win?.id ?? null;
            });
            expect(mainWindowId, 'MainWindow must be resolvable via __e2eTestRefs').not.toBeNull();

            // Simulate switching away
            await electronApp.evaluate(({BrowserWindow}, id: number) => {
                BrowserWindow.fromId(id)?.hide();
            }, mainWindowId as number);

            // Simulate switching back
            await electronApp.evaluate(({BrowserWindow}, id: number) => {
                const win = BrowserWindow.fromId(id);
                if (win) {
                    win.show();
                    win.focus();
                }
            }, mainWindowId as number);

            await expect.poll(
                () => electronApp.evaluate(({BrowserWindow}, id: number) =>
                    Boolean(BrowserWindow.fromId(id)?.isVisible()),
                mainWindowId as number),
                {timeout: 10_000, message: 'Main window must be visible after switching back'},
            ).toBe(true);

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
