// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication, Page} from 'playwright';

const TRANSIENT_EVALUATE_ERRORS = [
    'Execution context was destroyed',
    'Target page, context or browser has been closed',
    'Unable to find context',
];

export function isTransientEvaluateError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return TRANSIENT_EVALUATE_ERRORS.some((part) => message.includes(part));
}

type MainProcessEvaluator<T> = (
    _electron: typeof import('electron'),
) => T | Promise<T>;

export async function evaluateInMainProcess<T>(
    app: ElectronApplication,
    pageFunction: MainProcessEvaluator<T>,
    options: {timeoutMs?: number; retryDelayMs?: number} = {},
): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const retryDelayMs = options.retryDelayMs ?? 100;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            return await (app.evaluate as (fn: MainProcessEvaluator<T>) => Promise<T>).call(app, pageFunction);
        } catch (error) {
            if (!isTransientEvaluateError(error)) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
    }

    throw new Error('Timed out waiting for electron main-process evaluate');
}

type MainProcessEvaluatorWithArg<T, A> = (
    _electron: typeof import('electron'),
    arg: A,
) => T | Promise<T>;

export async function evaluateInMainProcessWithArg<T, A>(
    app: ElectronApplication,
    pageFunction: MainProcessEvaluatorWithArg<T, A>,
    arg: A,
    options: {timeoutMs?: number; retryDelayMs?: number} = {},
): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const retryDelayMs = options.retryDelayMs ?? 100;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            // Must call on `app` — extracting `app.evaluate` drops `this` and breaks _channel.
            return await (app.evaluate as (
                fn: MainProcessEvaluatorWithArg<T, A>,
                value: A,
            ) => Promise<T>).call(app, pageFunction, arg);
        } catch (error) {
            if (!isTransientEvaluateError(error)) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
    }

    throw new Error('Timed out waiting for electron main-process evaluate');
}

function findMainIndexWindow(app: ElectronApplication): Page | undefined {
    return app.windows().find((window) => {
        try {
            return window.url().includes('index');
        } catch {
            return false;
        }
    });
}

/**
 * Resolve the main wrapper window (index.html). On macOS CI the BrowserWindow can
 * exist before Playwright attaches it to app.windows(), especially when startup
 * load fails fast — poll and show the window from main process before giving up.
 */
export async function resolveMainIndexWindow(
    app: ElectronApplication,
    timeout = 15_000,
): Promise<Page> {
    let mainWindow: Page | undefined;

    await expect.poll(async () => {
        await evaluateInMainProcess(app, () => {
            const win = (global as any).__e2eTestRefs?.MainWindow?.get?.();
            if (win && !win.isDestroyed() && !win.isVisible()) {
                win.show();
            }
        }).catch(() => {});

        mainWindow = findMainIndexWindow(app);
        return mainWindow ?? null;
    }, {
        timeout,
        message: 'Main index window should be available',
    }).not.toBeNull();

    if (mainWindow) {
        return mainWindow;
    }

    return app.waitForEvent('window', {
        predicate: (window) => {
            try {
                return window.url().includes('index');
            } catch {
                return false;
            }
        },
        timeout: Math.min(5_000, timeout),
    });
}

export async function getMainWindowId(app: ElectronApplication): Promise<number> {
    let mainWindowId: number | null = null;
    await expect.poll(async () => {
        try {
            mainWindowId = await app.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                if (!refs) {
                    return null;
                }
                const win = refs.MainWindow.get();
                return win?.id ?? null;
            });
            return mainWindowId;
        } catch (error) {
            if (isTransientEvaluateError(error)) {
                return null;
            }
            throw error;
        }
    }, {
        timeout: 30_000,
        intervals: [200, 500, 1000],
        message: 'MainWindow id must be resolvable via __e2eTestRefs',
    }).not.toBeNull();

    if (mainWindowId == null) {
        throw new Error('MainWindow id was not available via __e2eTestRefs');
    }
    return mainWindowId;
}

export async function getActiveServerWebContentsId(app: ElectronApplication): Promise<number> {
    const id = await evaluateInMainProcess(app, () => {
        const refs = (global as any).__e2eTestRefs;
        if (!refs) {
            return null;
        }
        const view = refs.TabManager.getCurrentActiveTabView();
        return view?.webContentsId ?? null;
    });
    if (id == null) {
        throw new Error('Active server webContents id was not available via TabManager');
    }
    return id;
}
