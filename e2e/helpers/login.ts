// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerView} from './serverView';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;

async function waitForAppShell(win: ServerView, timeout: number) {
    const results = await Promise.allSettled([
        win.waitForSelector('#post_textbox', {timeout}),
        win.waitForSelector('#channelHeaderTitle', {timeout}),
        win.waitForSelector('input.search-bar.form-control', {timeout}),
    ]);

    return results.some((result) => result.status === 'fulfilled');
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
    if (!await waitForAppShell(win, timeout)) {
        throw new Error(`loginToMattermost: login succeeded but the app shell never became ready. Current URL: ${await win.url()}`);
    }
}

/**
 * Poll the main process until ServerManager reports isLoggedIn=true for the
 * current server, then wait for the renderer to reflect it (the #newTabButton
 * appearing in the main window DOM).
 *
 * The web app's desktopAPI.onLogin() → TAB_LOGIN_CHANGED → ServerManager.setLoggedIn
 * chain can lag behind the web app shell becoming visible. Tests that interact
 * with the tab bar (new tab, drag-and-drop, close tab) need isLoggedIn=true in
 * the renderer before proceeding.
 */
export async function waitForLoggedIn(
    electronApp: ElectronApplication,
    mainWindow: import('playwright').Page,
    timeout = 60_000,
): Promise<void> {
    const pollInterval = 500;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        const loggedIn = await electronApp.evaluate(() => {
            const refs = (global as any).__e2eTestRefs; // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!refs?.ServerManager) {
                return false;
            }
            const serverId = refs.ServerManager.getCurrentServerId?.();
            if (!serverId) {
                return false;
            }
            const server = refs.ServerManager.getServer?.(serverId);
            return Boolean(server?.isLoggedIn);
        }).catch(() => false);

        if (loggedIn) {
            break;
        }

        if (Date.now() + pollInterval > deadline) {
            throw new Error(
                `waitForLoggedIn: ServerManager.isLoggedIn never became true within ${timeout}ms`,
            );
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    await mainWindow.waitForSelector('#newTabButton', {timeout: Math.max(deadline - Date.now(), 5_000)});
}
