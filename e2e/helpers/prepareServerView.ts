// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {closeOverlayWindowsIfOpen} from './overlayWindows';
import {evaluateInMainProcessWithArg} from './testRefs';

/**
 * Close overlay windows and focus a Mattermost server WebContentsView so
 * renderer automation targets the channel UI instead of dropdown overlays.
 */
export async function prepareMattermostServerView(
    app: ElectronApplication,
    webContentsId: number,
): Promise<void> {
    await closeOverlayWindowsIfOpen(app);
    await evaluateInMainProcessWithArg(app, ({webContents}, id) => {
        const wc = webContents.fromId(id);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${id} is not available`);
        }
        wc.focus();
    }, webContentsId);
}
