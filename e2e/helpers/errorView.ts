// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {clearCertificateErrorCallbacks} from './dialog';

type WaitForErrorViewOptions = {
    serverName?: string;
    timeout?: number;
};

/**
 * Wait for the renderer to mount, then reload server views so load failures
 * that fired before IPC listeners were registered are surfaced in ErrorView.
 */
export async function waitForRendererThenReload(
    app: ElectronApplication,
    serverName?: string,
): Promise<void> {
    const mainWindow = app.windows().find((window) => window.url().includes('index'));
    if (!mainWindow) {
        return;
    }

    await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 15_000}).catch(() => {});

    if (serverName) {
        await expect.poll(() => {
            return !app.windows().some((window) => {
                try {
                    return window.url().includes('newServer');
                } catch {
                    return false;
                }
            });
        }, {timeout: 10_000, message: 'Add server modal should close after confirm'}).toBe(true);

        await expect.poll(async () => {
            return mainWindow.innerText('.ServerDropdownButton');
        }, {timeout: 10_000, message: `Active server should switch to ${serverName}`}).toContain(serverName);
    }

    // Wait until ServerManager knows about the target server. We intentionally do NOT
    // require a WebContentsManager entry to exist here: on platforms where the initial
    // load fails very fast (e.g. expired cert at startup), the view may never be added
    // to WebContentsManager before this poll's deadline. If no view exists, the reload
    // step below becomes a no-op and the existing load failure already surfaces in
    // `.ErrorView`, which is what the caller is polling for.
    //
    // NOTE: Playwright's ElectronApplication.evaluate(fn, arg) always passes the
    // `electron` module as the FIRST argument to `fn`. The user-supplied `arg` is the
    // SECOND argument. Hence the `(_electron, targetServerName)` signature below.
    await expect.poll(() => {
        return app.evaluate((_electron, targetServerName) => {
            const refs = (global as any).__e2eTestRefs;
            if (!refs) {
                return false;
            }
            const servers: Array<{id: string; name: string}> = refs.ServerManager?.getAllServers?.() ?? [];
            const serversToCheck = targetServerName ?
                servers.filter((server) => server.name === targetServerName) :
                servers;
            return serversToCheck.length > 0;
        }, serverName);
    }, {timeout: 15_000, message: 'Target server should be registered before reload'}).toBe(true);

    await clearCertificateErrorCallbacks(app).catch(() => {});

    await app.evaluate((_electron, targetServerName) => {
        const refs = (global as any).__e2eTestRefs;
        if (!refs) {
            return;
        }
        const servers: Array<{id: string; name: string}> = refs.ServerManager?.getAllServers?.() ?? [];
        const serversToReload = targetServerName ?
            servers.filter((server) => server.name === targetServerName) :
            servers;
        for (const server of serversToReload) {
            const views: Array<{id: string}> = refs.ViewManager?.getViewsByServerId?.(server.id) ?? [];
            for (const view of views) {
                const wcEntry = refs.WebContentsManager?.getView?.(view.id);
                wcEntry?.reload?.();
            }
        }
    }, serverName);

    await expect.poll(async () => {
        return app.evaluate((_electron, targetServerName) => {
            const refs = (global as any).__e2eTestRefs;
            if (!refs) {
                return false;
            }
            const servers: Array<{id: string; name: string}> = refs.ServerManager?.getAllServers?.() ?? [];
            const serversToCheck = targetServerName ?
                servers.filter((server) => server.name === targetServerName) :
                servers;
            for (const server of serversToCheck) {
                const views: Array<{id: string}> = refs.ViewManager?.getViewsByServerId?.(server.id) ?? [];
                for (const view of views) {
                    const wcEntry = refs.WebContentsManager?.getView?.(view.id);
                    if (wcEntry?.webContents?.isLoading?.()) {
                        return false;
                    }
                }
            }
            return true;
        }, serverName);
    }, {timeout: 15_000, message: 'Server views should finish reloading after renderer is ready'}).toBe(true);
}

export async function waitForErrorView(
    app: ElectronApplication,
    options: WaitForErrorViewOptions = {},
): Promise<void> {
    const timeout = options.timeout ?? 45_000;
    const deadline = Date.now() + timeout;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            const mainWindow = app.windows().find((window) => window.url().includes('index'));
            if (!mainWindow) {
                throw new Error('Main index window is not available yet');
            }
            await waitForRendererThenReload(app, options.serverName);
            await mainWindow.waitForSelector('.ErrorView', {
                timeout: Math.min(10_000, deadline - Date.now()),
            });
            return;
        } catch (error) {
            lastError = error;
            await clearCertificateErrorCallbacks(app).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    throw lastError instanceof Error ? lastError : new Error('ErrorView did not appear before timeout');
}
