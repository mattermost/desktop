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
 * Requires ensureLoggedInViaTestRefs() to have been called first so that
 * NavigationManager allows the navigation (isLoggedIn check).
 */
async function navigateFromSelectTeam(win: ServerView, timeout: number): Promise<void> {
    const url = await win.url().catch(() => '');
    if (!url.includes('/select_team') && !url.includes('/create_team')) {
        return;
    }

    // Navigate to the provisioned team's default channel using the Desktop API's
    // browser-history-push mechanism. Using window.location.pathname directly
    // would trigger a full-page reload which breaks Playwright's CDP connection.
    // sendBrowserHistoryPush() fires BROWSER_HISTORY_PUSH → NavigationManager
    // → renderer's onBrowserHistoryPush → browserHistory.push() (SPA navigation).
    const targetPath = `/${PROVISIONED_TEAM}/channels/town-square`;
    await win.evaluate((target: string) => {
        // eslint-disable-next-line no-underscore-dangle
        const api = (window as Record<string, unknown>).desktopAPI as {sendBrowserHistoryPush?: (path: string) => void} | undefined;
        if (api?.sendBrowserHistoryPush) {
            api.sendBrowserHistoryPush(target);
        }
    }, targetPath).catch(() => {
        // Silently skip if the view is unavailable or has navigated away
    });
    await win.waitForURL((u) => u.pathname.includes('/channels/'), {timeout}).catch(() => {
        // Non-fatal: if the URL didn't change to a channel, waitForAppShell will fail
        // and give a more descriptive error message.
    });
}

/**
 * After loginToMattermost confirms the web app is in a channel, set isLoggedIn
 * to true for all servers directly through the main-process test refs.
 *
 * This is a one-shot fallback for server versions (e.g. 9.4.0) where
 * desktopAPI.onLogin() may be dispatched before the WebContentsView is fully
 * registered, causing the TAB_LOGIN_CHANGED IPC event to be dropped and
 * isLoggedIn to remain false.  Callers still need to wait for the resulting
 * SERVER_LOGGED_IN_CHANGED event to propagate to the renderer.
 */
async function ensureLoggedInViaTestRefs(win: ServerView): Promise<void> {
    await win.app.evaluate(() => {
        // eslint-disable-next-line no-underscore-dangle
        const refs = (global as Record<string, unknown>).__e2eTestRefs as {
            ServerManager?: {setLoggedIn: (serverId: string, loggedIn: boolean) => void; getOrderedServers: () => Array<{id: string; isLoggedIn: boolean}>};
        } | undefined;
        if (!refs) {
            return;
        }

        const servers = refs.ServerManager?.getOrderedServers?.() ?? [];
        for (const server of servers) {
            if (!server.isLoggedIn) {
                refs.ServerManager?.setLoggedIn(server.id, true);
            }
        }
    }).catch(() => {
        // Silently ignore evaluate failures (e.g. if the app is still starting)
    });
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

    // Try the login form first with the full timeout.
    // If already logged in (e.g. active session), fall back to app shell check.
    let onLoginPage = false;
    try {
        await win.waitForSelector(loginSelector, {timeout});
        onLoginPage = true;
    } catch {
        // Login form not found — check if already in a channel
        if (await waitForAppShell(win, 5_000)) {
            // Already logged in; ensure isLoggedIn is set in the main process
            await ensureLoggedInViaTestRefs(win);
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
    // membership isn't yet visible to the web app at redirect time.
    // Before navigating, force isLoggedIn=true via test refs so that
    // NavigationManager.handleBrowserHistoryPush allows the navigation
    // (it blocks navigation when isLoggedIn=false).
    await ensureLoggedInViaTestRefs(win);

    // Now navigate to the provisioned team's channel if we're on /select_team
    await navigateFromSelectTeam(win, timeout);

    if (!await waitForAppShell(win, timeout)) {
        throw new Error(`loginToMattermost: login succeeded but the app shell never became ready. Current URL: ${await win.url()}`);
    }

    // Second call to ensureLoggedInViaTestRefs in case the initial isLoggedIn
    // was already true (normal servers) but the desktopAPI.onLogin() IPC event
    // was missed and the main process still has isLoggedIn=false.
    await ensureLoggedInViaTestRefs(win);
}
