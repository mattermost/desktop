// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {mattermostURL} from './config';
import type {ServerView} from './serverView';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;

function primaryTestServerHost(): string | undefined {
    try {
        const host = new URL(mattermostURL).hostname;
        return host || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Ensure the embedded server view has navigated to MM_TEST_SERVER_URL (not an
 * intermediate tab like github.com) before interacting with login selectors.
 */
async function waitForConfiguredServerOrigin(win: ServerView, timeout: number) {
    const host = primaryTestServerHost();
    if (!host) {
        return;
    }

    await win.waitForURL((url) => url.hostname === host, {timeout});
}

async function waitForAppShell(win: ServerView, timeout: number) {
    const results = await Promise.allSettled([
        win.waitForSelector('#post_textbox', {timeout}),
        win.waitForSelector('#channelHeaderTitle', {timeout}),
        win.waitForSelector('input.search-bar.form-control', {timeout}),
    ]);

    return results.some((result) => result.status === 'fulfilled');
}

async function syncMainProcessLoginFromWebShell(electronApp: ElectronApplication, webContentsId: number) {
    await electronApp.evaluate((id) => {
        const refs = (global as any).__e2eTestRefs; // eslint-disable-line @typescript-eslint/no-explicit-any
        refs?.WebContentsManager?.markTabLoginForE2e?.(id, true);
    }, webContentsId);
}

/**
 * Log in to a Mattermost server in the given window/page.
 * Requires MM_TEST_USER_NAME and MM_TEST_PASSWORD env vars.
 * Requires MM_TEST_SERVER_URL to be set in the app config (use demoMattermostConfig).
 */
export async function loginToMattermost(electronApp: ElectronApplication, win: ServerView): Promise<void> {
    const username = process.env.MM_TEST_USER_NAME;
    const password = process.env.MM_TEST_PASSWORD;

    if (!username || !password) {
        throw new Error('MM_TEST_USER_NAME and MM_TEST_PASSWORD must be set for tests requiring login');
    }

    const timeout = process.platform === 'win32' ? 60_000 : 30_000;

    await waitForConfiguredServerOrigin(win, timeout);

    const loginSelector = '#input_loginId';
    const passwordSelector = '#input_password-input, input[type="password"]';
    const submitSelector = 'button[type="submit"]';

    let onLoginPage = false;
    try {
        await win.waitForSelector(loginSelector, {timeout});
        onLoginPage = true;
    } catch {
        if (await waitForAppShell(win, 5_000)) {
            await syncMainProcessLoginFromWebShell(electronApp, win.webContentsId);
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
    await syncMainProcessLoginFromWebShell(electronApp, win.webContentsId);
}

/**
 * Poll until ServerManager reports isLoggedIn=true for the current server, or the
 * main-window tab bar exposes an enabled **#newTabButton** (renderer caught up).
 *
 * Some Mattermost server builds do not emit the desktop **onLogin** hook reliably;
 * in that case **ServerManager.isLoggedIn** can stay false even though the web app
 * shell is visible. Preferring **#newTabButton** enabled avoids hanging **beforeAll**
 * while still ensuring tab-bar interactions are safe.
 */
export async function waitForLoggedIn(
    electronApp: ElectronApplication,
    mainWindow: import('playwright').Page,
    timeout = 60_000,
): Promise<void> {
    const pollInterval = 500;
    const deadline = Date.now() + timeout;
    const newTabButton = mainWindow.locator('#newTabButton').first();

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

        let tabBarReady = false;
        try {
            tabBarReady = await newTabButton.isVisible() && await newTabButton.isEnabled();
        } catch {
            tabBarReady = false;
        }

        if (loggedIn || tabBarReady) {
            break;
        }

        if (Date.now() + pollInterval > deadline) {
            throw new Error(
                `waitForLoggedIn: login did not propagate within ${timeout}ms ` +
                '(ServerManager.isLoggedIn stayed false and #newTabButton never became enabled)',
            );
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    await mainWindow.waitForSelector('#newTabButton', {timeout: Math.max(deadline - Date.now(), 5_000)});
    await expect.poll(async () => newTabButton.isEnabled(), {
        timeout: Math.max(deadline - Date.now(), 15_000),
    }).toBe(true);
}
