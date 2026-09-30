// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {
    clickLoginHeaderBack,
    clickOpenIdAndWaitForDesktopAuth,
    enableOpenIdOnLoginPage,
    installWindowOpenStub,
    restoreLoginPageFetch,
    restoreWindowOpen,
    waitForLoginForm,
} from '../../helpers/loginSso';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';

// ── MM-T2633: External SSO-style link + back button ───────────────────
// Real user flow on desktop:
// 1. Login page → click an external provider button (Open ID, enabled via client-config fetch patch)
// 2. App navigates to /login/desktop (DesktopAuthToken) with login-header Back visible
// 3. window.open would launch the IdP externally — stubbed here so the test can
//    exercise the Back control without contacting a real provider.
//
// Note: Global-header [aria-label="Back"] (HistoryButtons) only renders when logged in;
// during login SSO the user sees [data-testid="back_button"] in the login header instead.

test.describe('login/sso_back_button', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(180_000);

    test(
        'MM-T2633 back button returns to login from desktop authentication',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            const serverWin = serverEntry?.win;
            expect(serverWin, 'Server view must exist').toBeTruthy();

            try {
                await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
                await waitForLoginForm(serverWin!);
                const openIdEnabled = await enableOpenIdOnLoginPage(serverWin!);
                if (!openIdEnabled) {
                    test.skip(true, 'OpenID login button not available on this server/webapp version');
                    return;
                }

                // Desktop SSO intermediate page — user clicks Open ID, then login-header Back.
                await installWindowOpenStub(serverWin!);
                await clickOpenIdAndWaitForDesktopAuth(serverWin!);
                await clickLoginHeaderBack(serverWin!);
                await waitForLoginForm(serverWin!);
                await restoreWindowOpen(serverWin!);
            } finally {
                await restoreWindowOpen(serverWin!).catch(() => {});
                await restoreLoginPageFetch(serverWin!).catch(() => {});
            }
        },
    );
});
