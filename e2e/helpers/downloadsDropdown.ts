// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {CLOSE_DOWNLOADS_DROPDOWN, CLOSE_DOWNLOADS_DROPDOWN_MENU} from './ipcChannels';

import {evaluateInMainProcessWithArg, isTransientNavigationError} from './testRefs';

/**
 * Close the downloads dropdown WebContentsView if it is open.
 * Parallel download specs can leave this overlay focused and block other UI flows.
 */
export async function closeDownloadsDropdownIfOpen(app: ElectronApplication): Promise<void> {
    await evaluateInMainProcessWithArg(app, ({ipcMain}, channels) => {
        ipcMain.emit(channels.menu);
        ipcMain.emit(channels.dropdown);
    }, {dropdown: CLOSE_DOWNLOADS_DROPDOWN, menu: CLOSE_DOWNLOADS_DROPDOWN_MENU}, {
        timeoutMs: 15_000,
        isRetryable: isTransientNavigationError,
    });
}
