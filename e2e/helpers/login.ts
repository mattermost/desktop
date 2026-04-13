// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import type {ServerView} from './serverView';

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
 * Wait until the main-process ServerManager marks the current server as logged in,
 * then wait for the tab-bar's #newTabButton to appear in the renderer.
 *
 * Background: after loginToMattermost() returns, the SERVER_LOGGED_IN_CHANGED IPC
 * event still needs to travel from the WebContentsView through the main process to
 * the renderer's MainPage.updateServers(). If that event fires before componentDidMount
 * registers the listener, the renderer never sees it and tabsDisabled stays true
 * indefinitely. Polling the main-process state directly sidesteps the race.
 */
export async function waitForTabBarEnabled(app: ElectronApplication, mainWindow: import('playwright').Page): Promise<void> {
    // Step 1: poll until at least one server is logged in at the main-process level.
    await expect.poll(
        async () => {
            try {
                return await app.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const servers: Array<{isLoggedIn: boolean}> = refs?.ServerManager?.getAllServers?.() ?? [];
                    return servers.some((s) => s.isLoggedIn);
                });
            } catch {
                return false;
            }
        },
        {
            message: 'Timed out waiting for a server to become logged-in in main process',
            timeout: 30_000,
            intervals: [200, 500, 1000],
        },
    ).toBe(true);

    // Step 2: wait for the renderer to reflect the logged-in state by showing the tab button.
    await mainWindow.waitForSelector('#newTabButton', {timeout: 15_000});
}
