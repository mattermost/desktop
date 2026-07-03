// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function closeOverlayWindowsIfOpen(app: ElectronApplication, timeoutMs = 3_000): Promise<void> {
    // app.evaluate can hang if the Electron main process is blocked or unresponsive
    // (e.g. during teardown). Cap the wait so setup/teardown never deadlock.
    const closePromise = app.evaluate(({BrowserWindow}) => {
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
    }).catch(() => {
        // Ignore evaluation failures (e.g. app already shutting down).
    });

    await Promise.race([closePromise, sleep(timeoutMs)]);
}
