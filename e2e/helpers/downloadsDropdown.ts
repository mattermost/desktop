// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {CLOSE_DOWNLOADS_DROPDOWN, CLOSE_DOWNLOADS_DROPDOWN_MENU} from '../../src/common/communication';

function isTransientNavigationError(message: string): boolean {
    return message.includes('Execution context was destroyed') ||
        message.includes('Target closed') ||
        message.includes('Protocol error');
}

/**
 * Close the downloads dropdown WebContentsView if it is open.
 * Parallel download specs can leave this overlay focused and block other UI flows.
 */
export async function closeDownloadsDropdownIfOpen(app: ElectronApplication): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            await app.evaluate(({ipcMain}, channels) => {
                ipcMain.emit(channels.menu);
                ipcMain.emit(channels.dropdown);
            }, {dropdown: CLOSE_DOWNLOADS_DROPDOWN, menu: CLOSE_DOWNLOADS_DROPDOWN_MENU});
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!isTransientNavigationError(message)) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    throw new Error('Timed out closing downloads dropdown after navigation');
}
