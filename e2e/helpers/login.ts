// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerView} from './serverView';

// Team provisioned by e2e/utils/server-setup.js in globalSetup.
const PROVISIONED_TEAM = 'e2e-team';

async function waitForAppShell(win: ServerView, timeout: number) {
    const results = await Promise.allSettled([
        win.waitForSelector('#post_textbox', {timeout}),
        win.waitForSelector('#channelHeaderTitle', {timeout}),
        win.waitForSelector('input.search-bar.form-control', {timeout}),
    ]);

    return results.some((result) => result.status === 'fulfilled');
}

/**
 * When the Mattermost server redirects to /select_team after login (e.g. on a
 * freshly provisioned server where team membership hasn't propagated yet),
 * navigate directly to the provisioned team's town-square channel.
 *
 * No-ops if the URL is already on a channel page.
 */
async function navigateFromSelectTeam(win: ServerView, timeout: number): Promise<void> {
    const url = await win.url();
    if (!url.includes('/select_team') && !url.includes('/create_team')) {
        return;
    }

    // Navigate to the provisioned team's default channel using window.location
    // assignment (ServerView doesn't have a goto() API; evaluate() runs JS in
    // the renderer context of the WebContentsView).
    const targetPath = `/${PROVISIONED_TEAM}/channels/town-square`;
    await win.evaluate(`window.location.pathname = ${JSON.stringify(targetPath)};`);
    await win.waitForURL((u) => u.pathname.includes('/channels/'), {timeout});
}

/**
 * Log in to a Mattermost server in the given window/page.
 * Requires MM_TEST_USER_NAME and MM_TEST_PASSWORD env vars.
 * Requires MM_TEST_SERVER_URL to be set in the app config (use demoMattermostConfig).
 */
export async function loginToMattermost(win: ServerView): Promise<void> {
    const username = process.env.MM_TEST_USER_NAME;
    const password = process.env.MM_TEST_PASSWORD;

    if (!username || !password) {
        throw new Error('MM_TEST_USER_NAME and MM_TEST_PASSWORD must be set for tests requiring login');
    }

    const timeout = process.platform === 'win32' ? 60_000 : 30_000;

    const loginSelector = '#input_loginId';
    const passwordSelector = '#input_password-input, input[type="password"]';
    const submitSelector = 'button[type="submit"]';

    let onLoginPage = false;
    try {
        await win.waitForSelector(loginSelector, {timeout});
        onLoginPage = true;
    } catch {
        if (await waitForAppShell(win, 5_000)) {
            return;
        }
    }

    if (!onLoginPage) {
        throw new Error(`loginToMattermost: login form was not found and the app shell never appeared. Current URL: ${await win.url()}`);
    }

    await win.fill(loginSelector, username);
    await win.fill(passwordSelector, password);
    await win.click(submitSelector);

    // Wait for login to complete: URL leaves /login
    await win.waitForURL((url) => !url.pathname.startsWith('/login'), {timeout});

    // Some freshly-provisioned servers redirect to /select_team because team
    // membership isn't yet visible to the web app at redirect time.  Navigate
    // directly to the provisioned team's town-square channel so the web app
    // fires onLogin() (TAB_LOGIN_CHANGED) and isLoggedIn becomes true.
    await navigateFromSelectTeam(win, timeout);

    if (!await waitForAppShell(win, timeout)) {
        throw new Error(`loginToMattermost: login succeeded but the app shell never became ready. Current URL: ${await win.url()}`);
    }
}
