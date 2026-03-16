// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication, Page} from 'playwright';

export type ServerEntry = {win: Page; webContentsId: number};
export type ServerMap = Record<string, ServerEntry[]>;

/**
 * Build a map of {serverName -> [{win, webContentsId}]} from the running app.
 *
 * Called after waitForAppReady() guarantees the app is initialized.
 * window.testHelper.getViewInfoForTest() is injected by externalAPI.ts
 * when NODE_ENV === 'test'.
 *
 * External windows = windows whose URL does NOT start with mattermost-desktop://
 * (i.e., the Mattermost server web app views, not the internal UI).
 */
export async function buildServerMap(app: ElectronApplication): Promise<ServerMap> {
    const maxRetries = 60;  // 6 seconds max (after appReady, windows should be fast)

    for (let i = 0; i < maxRetries; i++) {
        const externalWindows = app.windows().filter((win) => {
            try {
                const url = win.url();
                return url.length > 0 && !url.startsWith('mattermost-desktop://');
            } catch {
                return false;
            }
        });

        if (externalWindows.length === 0) {
            await sleep(100);
            continue;
        }

        const results = await Promise.all(
            externalWindows.map(async (win) => {
                try {
                    return await Promise.race([
                        win.evaluate(() => {
                            const helper = (window as any).testHelper;
                            if (!helper) return null;
                            return helper.getViewInfoForTest() as {serverName: string; webContentsId: number};
                        }),
                        sleep(3000).then(() => null),
                    ]);
                } catch {
                    return null;
                }
            }),
        );

        const map: ServerMap = {};
        externalWindows.forEach((win, idx) => {
            const result = results[idx] as {serverName: string; webContentsId: number} | null;
            if (result) {
                if (!map[result.serverName]) {
                    map[result.serverName] = [];
                }
                map[result.serverName].push({win, webContentsId: result.webContentsId});
            }
        });

        if (Object.keys(map).length > 0 && results.every((r) => r !== null)) {
            return map;
        }

        await sleep(100);
    }

    return {};
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
