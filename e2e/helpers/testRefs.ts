// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

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
