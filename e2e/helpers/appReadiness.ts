// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

/**
 * Wait until the main process has set global.__e2eAppReady = true.
 *
 * This flag is set in src/main/app/initialize.ts after handleMainWindowIsShown()
 * when NODE_ENV === 'test'. It fires once per app launch, after all views are
 * initialized and the main window is shown.
 *
 * IMPORTANT: app.evaluate() runs in the MAIN process context.
 * ipcRenderer does NOT exist there — only main-process Electron APIs do.
 * We read the global directly, not via IPC.
 */
export async function waitForAppReady(app: ElectronApplication): Promise<void> {
    await expect.poll(
        async () => {
            try {
                return await app.evaluate(() => (global as any).__e2eAppReady === true);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (
                    message.includes('Execution context was destroyed') ||
                    message.includes('Target page, context or browser has been closed')
                ) {
                    return false;
                }
                throw error;
            }
        },
        {
            message: 'Timed out waiting for __e2eAppReady. Check that initialize.ts sets it after handleMainWindowIsShown().',
            timeout: 30_000,
            intervals: [200, 500, 1000, 2000],
        },
    ).toBe(true);
}
