// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

/**
 * Close auxiliary BrowserWindows (server dropdown, downloads menu) that can
 * steal focus or keep Electron alive after app.close() on Windows.
 */
export async function closeOverlayWindowsIfOpen(app: ElectronApplication): Promise<void> {
    await app.evaluate(({BrowserWindow}) => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed()) {
                continue;
            }
            try {
                const url = win.webContents.getURL();
                if (url.includes('dropdown') || url.includes('downloadsDropdown.html')) {
                    win.close();
                }
            } catch {
                // Ignore windows that disappear while iterating.
            }
        }
    });
}
