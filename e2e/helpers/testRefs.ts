// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

export async function getMainWindowId(app: ElectronApplication): Promise<number> {
    let mainWindowId: number | null = null;
    await expect.poll(async () => {
        try {
            mainWindowId = await app.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const win = refs?.MainWindow?.get?.();
                return win?.id ?? null;
            });
            return mainWindowId;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                message.includes('Execution context was destroyed') ||
                message.includes('Target page, context or browser has been closed')
            ) {
                return null;
            }
            throw error;
        }
    }, {
        timeout: 30_000,
        intervals: [200, 500, 1000],
        message: 'MainWindow id must be resolvable via __e2eTestRefs',
    }).not.toBeNull();

    if (mainWindowId == null) {
        throw new Error('MainWindow id was not available via __e2eTestRefs');
    }
    return mainWindowId;
}

export async function getActiveServerWebContentsId(app: ElectronApplication): Promise<number> {
    const id = await app.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        const view = refs?.TabManager?.getCurrentActiveTabView?.();
        return view?.webContentsId ?? null;
    });
    if (id == null) {
        throw new Error('Active server webContents id was not available via TabManager');
    }
    return id;
}
