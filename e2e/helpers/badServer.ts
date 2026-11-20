// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication, Page} from 'playwright';

export const UNREACHABLE_SERVER_URL = 'https://jhsgefhjsaeiuofhseifuphoauifdhjauiowijdfcpohuawoiudfjpdhauwodjahwdpojaoiwdhawhdiuawd.com';
export const EXPIRED_CERT_URL = 'https://expired.badssl.com';
export const TLS_1_0_URL = 'https://tls-v1-0.badssl.com:1010';
export const TLS_1_1_URL = 'https://tls-v1-1.badssl.com';
export const RC4_CIPHER_URL = 'https://rc4.badssl.com';

/** DNS / host resolution failures (stable across platforms). */
export const DNS_FAILURE_ERROR = /ERR_NAME_NOT_RESOLVED/;

/** Certificate expiry failures surfaced before retry exhaustion. */
export const EXPIRED_CERT_ERROR = /ERR_CERT_DATE_INVALID/;

/** Obsolete TLS versions rejected during handshake. */
export const OBSOLETE_TLS_ERROR = /ERR_SSL_(VERSION_OR_CIPHER_MISMATCH|PROTOCOL_ERROR)/;

/**
 * Insecure cipher/protocol endpoints (e.g. RC4-only). Modern Chromium may reset the
 * connection instead of completing a handshake with OBSOLETE_CIPHER, so accept that
 * specific reset alongside the SSL-handshake errors. Deliberately does NOT include
 * generic codes like ERR_CONNECTION_CLOSED or ERR_NETWORK_* — those can fire for
 * unrelated causes (CI network blips, proxy resets) and would let this test pass
 * without the app ever having rejected an insecure cipher.
 */
export const INSECURE_CIPHER_ERROR = /ERR_(SSL_(OBSOLETE_CIPHER|VERSION_OR_CIPHER_MISMATCH|PROTOCOL_ERROR)|CONNECTION_RESET)/;

export function getMainWindow(app: ElectronApplication): Page {
    const mainWindow = app.windows().find((window) => window.url().includes('index'));
    expect(mainWindow, 'Main window (index) must exist').toBeDefined();
    return mainWindow!;
}

/**
 * Wait until the renderer MainPage has mounted (IPC listeners registered).
 */
export async function waitForRendererReady(mainWindow: Page): Promise<void> {
    await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 15_000});
}

/**
 * Reload server views through the app's MattermostWebContentsView.reload() so
 * LOAD_FAILED is emitted on certificate / connection errors.
 */
export async function reloadServerViewsFromMainProcess(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        if (!refs) {
            // Not yet populated this early in boot — caller polls and retries.
            return;
        }

        // Deliberately NOT optional-chained past this point: if ServerManager/
        // ViewManager/WebContentsManager are renamed, this should throw immediately
        // instead of silently reloading nothing and leaving the caller to time out
        // 45s later with a generic "ErrorView did not appear" message.
        const servers: Array<{id: string}> = refs.ServerManager.getAllServers();
        for (const server of servers) {
            const views: Array<{id: string}> = refs.ViewManager.getViewsByServerId(server.id);
            for (const view of views) {
                const wcEntry = refs.WebContentsManager.getView(view.id);
                wcEntry?.reload?.();
            }
        }
    });
}

async function readTerminalLoadFailure(
    mainWindow: Page,
    acceptedError: RegExp,
): Promise<string | null> {
    if (!(await mainWindow.isVisible('.ErrorView'))) {
        return null;
    }

    const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
    if ((/ERR_ABORTED/).test(errorInfo) && !acceptedError.test(errorInfo)) {
        return null;
    }

    return acceptedError.test(errorInfo) ? errorInfo : null;
}

/**
 * Wait for ErrorView with a terminal Chromium load error. Ignores transient
 * ERR_ABORTED states that can appear while a reload is in flight.
 */
export async function waitForTerminalLoadFailure(
    mainWindow: Page,
    acceptedError: RegExp,
    timeoutMs = 45_000,
): Promise<string> {
    let errorInfo = '';

    await expect.poll(async () => {
        errorInfo = await readTerminalLoadFailure(mainWindow, acceptedError) ?? '';
        return Boolean(errorInfo);
    }, {
        timeout: timeoutMs,
        message: `ErrorView must show a terminal load failure matching ${acceptedError}`,
    }).toBe(true);

    return errorInfo;
}

export async function waitForRendererReadyThenReload(
    app: ElectronApplication,
    acceptedError: RegExp,
): Promise<Page> {
    const mainWindow = getMainWindow(app);
    await waitForRendererReady(mainWindow);

    if (!(await readTerminalLoadFailure(mainWindow, acceptedError))) {
        await reloadServerViewsFromMainProcess(app);
    }

    return mainWindow;
}

export async function expectConnectionErrorView(
    mainWindow: Page,
    acceptedError: RegExp,
    options?: {timeoutMs?: number},
): Promise<void> {
    const errorInfo = await waitForTerminalLoadFailure(
        mainWindow,
        acceptedError,
        options?.timeoutMs,
    );
    expect(errorInfo).toMatch(acceptedError);
}
