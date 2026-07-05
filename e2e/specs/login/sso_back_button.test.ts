// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {
    clickLoginHeaderBack,
    clickOpenIdAndWaitForDesktopAuth,
    clickOpenIdLoginButton,
    enableOpenIdOnLoginPage,
    installWindowOpenStub,
    navigateBackInServerView,
    restoreLoginPageFetch,
    restoreWindowOpen,
    waitForDesktopAuthPage,
    waitForLoginForm,
    waitForMockIdpPage,
} from '../../helpers/loginSso';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {
    getShellOpenExternalCalls,
    restoreShellOpenExternal,
    stubShellOpenExternal,
} from '../../helpers/shell';

// ── MM-T2633: External SSO-style link + back button ───────────────────
// Real user flow on desktop:
// 1. Login page → click an external provider button (Open ID, enabled via client-config fetch patch)
// 2. App navigates to /login/desktop (DesktopAuthToken) with login-header Back visible
// 3. window.open would launch the IdP — stubbed to an in-window mock page (no real IdP)
// 4. User returns via login-header Back (during /login/desktop) or browser-back after mock IdP
//
// Note: Global-header [aria-label="Back"] (HistoryButtons) only renders when logged in;
// during login SSO the user sees [data-testid="back_button"] in the login header instead.

test.describe('login/sso_back_button', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(180_000);

    test(
        'MM-T2633 back button returns to login after mock SSO navigation',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            const serverWin = serverEntry?.win;
            expect(serverWin, 'Server view must exist').toBeTruthy();

            const windowsBefore = electronApp.windows().length;

            await stubShellOpenExternal(electronApp);

            try {
                await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
                await waitForLoginForm(serverWin!);
                await enableOpenIdOnLoginPage(serverWin!);

                // Phase 1: desktop SSO intermediate page — user clicks Open ID, then login-header Back.
                await installWindowOpenStub(serverWin!, 'noop');
                await clickOpenIdAndWaitForDesktopAuth(serverWin!);
                await clickLoginHeaderBack(serverWin!);
                await waitForLoginForm(serverWin!);
                await restoreWindowOpen(serverWin!);

                // Phase 2: repeat — user clicks Open ID again, back from /login/desktop.
                await installWindowOpenStub(serverWin!, 'noop');
                await clickOpenIdAndWaitForDesktopAuth(serverWin!);
                await clickLoginHeaderBack(serverWin!);
                await waitForLoginForm(serverWin!);
                await restoreWindowOpen(serverWin!);

                // Phase 3: in-window mock IdP (window.open stub) — user returns via browser back.
                await installWindowOpenStub(serverWin!, 'mock-idp');
                await clickOpenIdLoginButton(serverWin!);
                await waitForDesktopAuthPage(serverWin!);
                await waitForMockIdpPage(serverWin!);
                await navigateBackInServerView(serverWin!);
                await expect.poll(
                    async () => serverWin!.evaluate(() => Boolean(document.querySelector('#input_loginId'))),
                    {timeout: 15_000, message: 'Browser back must return to the Mattermost login form'},
                ).toBe(true);

                expect(await getShellOpenExternalCalls(electronApp)).toHaveLength(0);
                expect(electronApp.windows().length, 'SSO-style flow must stay in the main window').toBe(windowsBefore);
            } finally {
                await restoreWindowOpen(serverWin!).catch(() => {});
                await restoreLoginPageFetch(serverWin!).catch(() => {});
                await restoreShellOpenExternal(electronApp);
            }
        },
    );
});
