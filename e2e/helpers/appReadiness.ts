// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

export async function waitForAppReady(app: ElectronApplication): Promise<void> {
    const timeout = process.platform === 'linux' ? 30_000 : 60_000;

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
            message: `Timed out waiting for __e2eAppReady (${timeout}ms)`,
            timeout,
            intervals: [200, 500, 1000, 2000],
        },
    ).toBe(true);
}
