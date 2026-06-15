// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

/**
 * Close the downloads dropdown BrowserWindow if it is open.
 * Parallel download specs can leave this window focused and block other UI flows.
 */
export async function closeDownloadsDropdownIfOpen(app: ElectronApplication): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            await app.evaluate(({BrowserWindow}) => {
                for (const win of BrowserWindow.getAllWindows()) {
                    if (win.isDestroyed()) {
                        continue;
                    }
                    try {
                        if (win.webContents.getURL().includes('downloadsDropdown.html')) {
                            win.close();
                        }
                    } catch {
                        // Ignore windows that disappear while iterating.
                    }
                }
            });
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Execution context was destroyed')) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    throw new Error('Timed out closing downloads dropdown after navigation');
}
