// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {ServerView} from './serverView';

export type ServerEntry = {win: ServerView; webContentsId: number};
export type ServerMap = Record<string, ServerEntry[]>;

/**
 * Build a map of {serverName -> [{win, webContentsId}]} from the running app.
 * Server views are embedded WebContentsView instances, so they are discovered
 * through main-process registries instead of app.windows().
 */
export async function buildServerMap(app: ElectronApplication): Promise<ServerMap> {
    const maxRetries = 120;

    for (let i = 0; i < maxRetries; i++) {
        let entries: Array<{serverName: string; webContentsId: number; isPrimary: boolean}> = [];
        try {
            entries = await app.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                if (!refs) {
                    return [];
                }

                const servers = refs.ServerManager.getAllServers();
                return servers.flatMap((server: {id: string; name: string}) => {
                    const views = refs.ViewManager.getViewsByServerId(server.id);
                    return views.map((view: {id: string}) => {
                        const webContentsView = refs.WebContentsManager.getView(view.id);
                        if (!webContentsView) {
                            return null;
                        }

                        return {
                            serverName: server.name,
                            webContentsId: webContentsView.webContentsId,
                            isPrimary: refs.ViewManager.isPrimaryView(view.id),
                        };
                    }).filter(Boolean);
                });
            }) as Array<{serverName: string; webContentsId: number; isPrimary: boolean}>;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                message.includes('Execution context was destroyed') ||
                message.includes('Target page, context or browser has been closed')
            ) {
                await sleep(100);
                continue;
            }
            throw error;
        }

        const map: ServerMap = {};
        for (const entry of entries) {
            if (!map[entry.serverName]) {
                map[entry.serverName] = [];
            }
            map[entry.serverName].push({
                win: new ServerView(app, entry.webContentsId),
                webContentsId: entry.webContentsId,
            });
        }

        Object.values(map).forEach((serverEntries) => {
            serverEntries.sort((left, right) => left.webContentsId - right.webContentsId);
        });

        if (Object.keys(map).length > 0) {
            return map;
        }

        await sleep(100);
    }

    const availableUrls = await app.evaluate(({webContents}) => {
        return webContents.getAllWebContents().map((wc) => wc.getURL() || `<id:${wc.id}>`).join(', ');
    });
    throw new Error(
        `buildServerMap timed out after ${maxRetries * 100}ms waiting for server webContents.\n` +
        `Available webContents: [${availableUrls}]`,
    );
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
