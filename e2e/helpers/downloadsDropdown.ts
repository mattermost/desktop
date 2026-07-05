// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

/**
 * Close the downloads dropdown BrowserWindow and embedded menu view if open.
 * Parallel download specs can leave these focused and block other UI flows.
 */
const hasDownloadsDropdownOpen = async (app: ElectronApplication): Promise<boolean> => {
    return app.evaluate(({BrowserWindow}) => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed()) {
                continue;
            }
            try {
                if (win.webContents.getURL().includes('downloadsDropdown')) {
                    return true;
                }
            } catch {
                // Ignore windows that disappear while iterating.
            }
        }
        return false;
    }).catch(() => false);
};

export async function closeDownloadsDropdownIfOpen(app: ElectronApplication): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            const foundDropdown = await app.evaluate(({BrowserWindow, ipcMain}) => {
                ipcMain.emit('close-downloads-dropdown-menu');
                ipcMain.emit('close-downloads-dropdown');

                let found = false;
                for (const win of BrowserWindow.getAllWindows()) {
                    if (win.isDestroyed()) {
                        continue;
                    }
                    try {
                        const url = win.webContents.getURL();
                        if (url.includes('downloadsDropdown')) {
                            found = true;
                            win.close();
                        }
                    } catch {
                        // Ignore windows that disappear while iterating.
                    }
                }
                return found;
            });
            if (!foundDropdown) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Execution context was destroyed')) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    if (await hasDownloadsDropdownOpen(app)) {
        throw new Error('Timed out closing downloads dropdown after navigation');
    }
}
