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

export function isTransientNavigationError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return isTransientEvaluateError(error) ||
        message.includes('Target closed') ||
        message.includes('Protocol error');
}

type EvaluateRetryOptions = {
    timeoutMs?: number;
    retryDelayMs?: number;
    isRetryable?: (error: unknown) => boolean;
};

type MainProcessEvaluator<T> = (
    _electron: typeof import('electron'),
) => T | Promise<T>;

export async function evaluateInMainProcess<T>(
    app: ElectronApplication,
    pageFunction: MainProcessEvaluator<T>,
    options: EvaluateRetryOptions = {},
): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const retryDelayMs = options.retryDelayMs ?? 100;
    const isRetryable = options.isRetryable ?? isTransientEvaluateError;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            return await (app.evaluate as (fn: MainProcessEvaluator<T>) => Promise<T>).call(app, pageFunction);
        } catch (error) {
            if (!isRetryable(error)) {
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
    options: EvaluateRetryOptions = {},
): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const retryDelayMs = options.retryDelayMs ?? 100;
    const isRetryable = options.isRetryable ?? isTransientEvaluateError;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            // Must call on `app` — extracting `app.evaluate` drops `this` and breaks _channel.
            return await (app.evaluate as (
                fn: MainProcessEvaluatorWithArg<T, A>,
                value: A,
            ) => Promise<T>).call(app, pageFunction, arg);
        } catch (error) {
            if (!isRetryable(error)) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
    }

    throw new Error('Timed out waiting for electron main-process evaluate');
}

function isMainIndexUrl(url: string): boolean {
    return url.includes('index');
}

export function findMainIndexWindow(app: ElectronApplication): Page | undefined {
    return app.windows().find((window) => {
        try {
            return isMainIndexUrl(window.url());
        } catch {
            return false;
        }
    });
}

async function findMainIndexWindowByBrowserId(
    app: ElectronApplication,
    browserWindowId: number,
): Promise<Page | undefined> {
    for (const window of app.windows()) {
        try {
            const browserWin = await app.browserWindow(window);
            const id = await browserWin.evaluate((win: {id: number}) => win.id);
            if (id === browserWindowId) {
                return window;
            }
        } catch {
            // Window may still be attaching.
        }
    }
    return undefined;
}

async function ensureMainWindowVisible(app: ElectronApplication): Promise<number | null> {
    return evaluateInMainProcess(app, () => {
        const refs = (global as any).__e2eTestRefs;
        const win = refs?.MainWindow?.get?.();
        if (win && !win.isDestroyed()) {
            if (!win.isVisible()) {
                win.show();
            }
            win.focus();
            return win.id;
        }
        return null;
    }).catch(() => null);
}

/**
 * Resolve the main wrapper window (index.html). On macOS CI the BrowserWindow can
 * exist before Playwright attaches it to app.windows(), especially when startup
 * load fails fast — show/focus from main process and match by BrowserWindow id.
 */
export async function resolveMainIndexWindow(
    app: ElectronApplication,
    timeout = 30_000,
): Promise<Page> {
    const deadline = Date.now() + timeout;
    let mainWindow: Page | undefined;

    while (Date.now() < deadline) {
        const mainWindowId = await ensureMainWindowVisible(app);

        mainWindow = findMainIndexWindow(app);
        if (!mainWindow && mainWindowId != null) {
            mainWindow = await findMainIndexWindowByBrowserId(app, mainWindowId);
        }

        if (mainWindow) {
            return mainWindow;
        }

        const remaining = deadline - Date.now();
        if (remaining <= 0) {
            break;
        }

        try {
            return await app.waitForEvent('window', {
                predicate: (window) => {
                    try {
                        return isMainIndexUrl(window.url());
                    } catch {
                        return false;
                    }
                },
                timeout: Math.min(2_000, remaining),
            });
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }

    throw new Error('Main index window should be available');
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
