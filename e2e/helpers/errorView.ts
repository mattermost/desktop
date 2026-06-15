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

    await expect.poll(async () => {
        return app.evaluate((targetServerName) => {
            const refs = (global as any).__e2eTestRefs;
            if (!refs) {
                return false;
            }
            const servers: Array<{id: string; name: string}> = refs.ServerManager?.getAllServers?.() ?? [];
            const serversToCheck = targetServerName ?
                servers.filter((server) => server.name === targetServerName) :
                servers;
            if (serversToCheck.length === 0) {
                return false;
            }
            return serversToCheck.every((server) => {
                const views: Array<{id: string}> = refs.ViewManager?.getViewsByServerId?.(server.id) ?? [];
                return views.some((view) => Boolean(refs.WebContentsManager?.getView?.(view.id)));
            });
        }, serverName);
    }, {timeout: 15_000, message: 'Server views should exist before reload'}).toBe(true);

    await clearCertificateErrorCallbacks(app).catch(() => {});

    await app.evaluate((targetServerName) => {
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
        return app.evaluate((targetServerName) => {
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
    const mainWindow = app.windows().find((window) => window.url().includes('index'));
    expect(mainWindow).toBeDefined();

    const deadline = Date.now() + timeout;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            await waitForRendererThenReload(app, options.serverName);
            await mainWindow!.waitForSelector('.ErrorView', {
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
