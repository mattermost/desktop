// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import type {ServerView} from './serverView';
import {recoverServerViewIfNeeded} from './mattermostShell';

async function hasAppShell(win: ServerView): Promise<boolean> {
    return win.runInRenderer<boolean>(`
        return Boolean(
            document.querySelector('#post_textbox')
            || document.querySelector('#channelHeaderTitle')
            || document.querySelector('input.search-bar.form-control'),
        );
    `).catch(() => false);
}

async function hasLoginForm(win: ServerView): Promise<boolean> {
    return win.runInRenderer<boolean>(`
        return Boolean(document.querySelector('#input_loginId'));
    `).catch(() => false);
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
    const submitSelector = '#saveSetting, button[type="submit"]';

    await recoverServerViewIfNeeded(win).catch(() => {});

    await expect.poll(async () => {
        if (await hasAppShell(win)) {
            return 'logged-in';
        }
        if (await hasLoginForm(win)) {
            return 'login-form';
        }
        return 'loading';
    }, {
        timeout,
        intervals: [500, 1000, 2000],
        message: 'Mattermost login form or app shell must appear',
    }).not.toBe('loading');

    if (await hasAppShell(win)) {
        return;
    }

    await win.fill(loginSelector, username);
    await win.fill(passwordSelector, password);
    await win.click(submitSelector);

    await win.waitForURL((url) => !url.pathname.startsWith('/login'), {timeout});
    await expect.poll(async () => hasAppShell(win), {
        timeout,
        intervals: [500, 1000, 2000],
        message: 'Mattermost app shell must appear after login',
    }).toBe(true);
}
