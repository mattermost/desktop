// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from 'playwright';

/**
 * Log in to a Mattermost server in the given window/page.
 * Requires MM_TEST_USER_NAME and MM_TEST_PASSWORD env vars.
 * Requires MM_TEST_SERVER_URL to be set in the app config (use demoMattermostConfig).
 */
export async function loginToMattermost(win: Page): Promise<void> {
    const username = process.env.MM_TEST_USER_NAME;
    const password = process.env.MM_TEST_PASSWORD;

    if (!username || !password) {
        throw new Error('MM_TEST_USER_NAME and MM_TEST_PASSWORD must be set for tests requiring login');
    }

    const timeout = process.platform === 'win32' ? 60_000 : 30_000;

    await win.waitForSelector('#input_loginId', {timeout});
    await win.waitForSelector('#input_password-input', {timeout});

    await win.fill('#input_loginId', username);
    await win.fill('#input_password-input', password);
    await win.click('#saveSetting');

    // Wait for login to complete: login page disappears
    await win.waitForSelector('#input_loginId', {state: 'detached', timeout});
}
