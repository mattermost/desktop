// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import type {ServerView} from './serverView';

const MOCK_IDP_TITLE_SELECTOR = '#mock-idp-title';

export async function waitForLoginForm(serverWin: ServerView): Promise<void> {
    await serverWin.waitForSelector('#input_loginId', {timeout: 60_000});
}

/**
 * Patch client config fetch so the login page renders a real OpenID external-login
 * button with the desktop handleExternalAuth onClick handler (no injected DOM).
 */
export async function enableOpenIdOnLoginPage(serverWin: ServerView): Promise<void> {
    const installFetchPatch = async () => {
        await serverWin.evaluate(() => {
            const originalFetch = window.fetch.bind(window);
            (window as any).__e2eOriginalFetch = originalFetch;
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
                const response = await originalFetch(input, init);
                let url: string;
                if (typeof input === 'string') {
                    url = input;
                } else if (input instanceof URL) {
                    url = input.href;
                } else {
                    url = input.url;
                }
                if (!url.includes('/api/v4/config/client')) {
                    return response;
                }

                const json = await response.clone().json();
                return new Response(JSON.stringify({
                    ...json,
                    EnableSignUpWithOpenId: 'true',
                    OpenIdButtonText: 'Open ID',
                }), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });
            };
        });
    };

    await installFetchPatch();
    await serverWin.evaluate(() => {
        window.location.reload();
    });
    await installFetchPatch();
    await waitForLoginForm(serverWin);
}

export async function restoreLoginPageFetch(serverWin: ServerView): Promise<void> {
    await serverWin.evaluate(() => {
        const original = (window as any).__e2eOriginalFetch;
        if (original) {
            window.fetch = original;
        }
        delete (window as any).__e2eOriginalFetch;
    });
}

export async function waitForOpenIdLoginButton(serverWin: ServerView): Promise<void> {
    await serverWin.waitForSelector('#openid.external-login-button', {timeout: 30_000});
}

/** Desktop login header back control shown during /login/desktop (HeaderFooterRoute BackButton). */
export async function clickLoginHeaderBack(serverWin: ServerView): Promise<void> {
    const backButton = serverWin.locator('[data-testid="back_button"]');
    await expect.poll(
        () => backButton.isVisible(),
        {timeout: 10_000, message: 'Login header Back must be visible during desktop SSO'},
    ).toBe(true);
    await backButton.click();
}

/**
 * Desktop global-header history control (visible only when logged in).
 * MM-T2633 login SSO uses clickLoginHeaderBack instead; this is used when the
 * webapp shell is still mounted after in-window navigation.
 */
export async function clickWebappHistoryBackIfVisible(serverWin: ServerView): Promise<boolean> {
    const back = serverWin.locator('[aria-label="Back"]');
    if ((await back.count()) === 0) {
        return false;
    }
    await back.nth(0).click();
    return true;
}

export type WindowOpenStubMode = 'noop' | 'mock-idp';

export async function installWindowOpenStub(serverWin: ServerView, mode: WindowOpenStubMode): Promise<void> {
    await serverWin.evaluate((stubMode) => {
        (window as any).__e2eOriginalWindowOpen = window.open.bind(window);
        window.open = () => {
            if (stubMode === 'noop') {
                return null;
            }

            const mockHtml = '<!DOCTYPE html><html><head><title>Mock SSO</title></head>' +
                '<body><h1 id="mock-idp-title">Mock SSO Provider</h1></body></html>';
            document.open();
            document.write(mockHtml);
            document.close();
            return null;
        };
    }, mode);
}

export async function restoreWindowOpen(serverWin: ServerView): Promise<void> {
    await serverWin.evaluate(() => {
        const original = (window as any).__e2eOriginalWindowOpen;
        if (original) {
            window.open = original;
        }
        delete (window as any).__e2eOriginalWindowOpen;
    });
}

export async function clickOpenIdLoginButton(serverWin: ServerView): Promise<void> {
    await waitForOpenIdLoginButton(serverWin);
    await serverWin.click('#openid.external-login-button');
}

export async function waitForDesktopAuthPage(serverWin: ServerView): Promise<void> {
    await serverWin.waitForURL((url) => url.pathname.includes('/login/desktop'), {timeout: 30_000});
    await serverWin.waitForSelector('.DesktopAuthToken', {timeout: 15_000});
}

export async function waitForMockIdpPage(serverWin: ServerView): Promise<void> {
    await serverWin.waitForSelector(MOCK_IDP_TITLE_SELECTOR, {timeout: 15_000});
}

/** Browser-style back after mock in-window IdP (same WebContentsView). */
export async function navigateBackInServerView(serverWin: ServerView): Promise<void> {
    const usedWebappBack = await clickWebappHistoryBackIfVisible(serverWin);
    if (usedWebappBack) {
        return;
    }

    const backShortcut = process.platform === 'darwin' ? 'Meta+[' : 'Alt+ArrowLeft';
    await serverWin.keyboard.press(backShortcut);

    const returnedToMattermost = await expect.poll(
        () => serverWin.evaluate(() => {
            return Boolean(document.querySelector('#input_loginId')) ||
                Boolean(document.querySelector('.DesktopAuthToken')) ||
                window.location.pathname.includes('/login');
        }).catch(() => false),
        {timeout: 3_000},
    ).toBe(true).then(() => true).catch(() => false);

    if (!returnedToMattermost) {
        await serverWin.evaluate(() => {
            window.history.back();
        });
    }
}

export async function clickOpenIdAndWaitForDesktopAuth(serverWin: ServerView): Promise<void> {
    await clickOpenIdLoginButton(serverWin);
    await waitForDesktopAuthPage(serverWin);
}
