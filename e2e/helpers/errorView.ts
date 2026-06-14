// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

/**
 * Wait for the renderer to mount, then reload server views so load failures
 * that fired before IPC listeners were registered are surfaced in ErrorView.
 */
export async function waitForRendererThenReload(app: ElectronApplication): Promise<void> {
    const mainWindow = app.windows().find((window) => window.url().includes('index'));
    if (!mainWindow) {
        return;
    }

    await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 15_000}).catch(() => {});

    await app.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        if (!refs) {
            return;
        }
        const servers: Array<{id: string}> = refs.ServerManager?.getAllServers?.() ?? [];
        for (const server of servers) {
            const views: Array<{id: string}> = refs.ViewManager?.getViewsByServerId?.(server.id) ?? [];
            for (const view of views) {
                const wcEntry = refs.WebContentsManager?.getView?.(view.id);
                wcEntry?.reload?.();
            }
        }
    });

    await expect.poll(async () => {
        return app.evaluate(() => {
            const refs = (global as any).__e2eTestRefs;
            if (!refs) {
                return false;
            }
            const servers: Array<{id: string}> = refs.ServerManager?.getAllServers?.() ?? [];
            for (const server of servers) {
                const views: Array<{id: string}> = refs.ViewManager?.getViewsByServerId?.(server.id) ?? [];
                for (const view of views) {
                    const wcEntry = refs.WebContentsManager?.getView?.(view.id);
                    if (wcEntry?.webContents?.isLoading?.()) {
                        return false;
                    }
                }
            }
            return true;
        });
    }, {timeout: 10_000, message: 'Server views should finish reloading after renderer is ready'}).toBe(true);
}

export async function waitForErrorView(app: ElectronApplication, timeout = 30_000): Promise<void> {
    const mainWindow = app.windows().find((window) => window.url().includes('index'));
    expect(mainWindow).toBeDefined();
    await waitForRendererThenReload(app);
    await mainWindow!.waitForSelector('.ErrorView', {timeout});
}
