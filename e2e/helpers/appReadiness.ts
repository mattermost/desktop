// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication, Page} from 'playwright';

const MAIN_WINDOW_POLL_MS = 200;

export function findMainWindow(app: ElectronApplication): Page | undefined {
    return app.windows().find((window) => {
        try {
            return window.url().includes('index');
        } catch {
            return false;
        }
    });
}

/** Resolve the internal main window (index.html wrapper). */
export async function waitForMainWindow(
    app: ElectronApplication,
    options?: {timeout?: number},
): Promise<Page> {
    const timeout = options?.timeout ?? 30_000;
    let mainWindow: Page | undefined;

    await expect.poll(async () => {
        mainWindow = findMainWindow(app);
        return mainWindow;
    }, {
        timeout,
        intervals: [MAIN_WINDOW_POLL_MS, 500, 1000],
        message: 'Main window (index.html) must appear',
    }).not.toBeUndefined();

    if (!mainWindow) {
        throw new Error(
            'Main window was not available.\n' +
            `Available: ${app.windows().map((window) => window.url()).join(', ')}`,
        );
    }

    return mainWindow;
}

/**
 * Wait until main-window chrome needed for server management is rendered.
 * Used when config already lists servers — catches broken wrapper UI that
 * __e2eAppReady alone would miss.
 */
export async function waitForMainWindowChrome(
    app: ElectronApplication,
    options?: {requireServerDropdown?: boolean; timeout?: number},
): Promise<Page> {
    const timeout = options?.timeout ?? 30_000;
    const deadline = Date.now() + timeout;
    const mainWindow = await waitForMainWindow(app, {timeout});

    if (options?.requireServerDropdown) {
        const remaining = Math.max(0, deadline - Date.now());
        await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: remaining});
    }

    return mainWindow;
}

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
