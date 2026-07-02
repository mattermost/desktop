// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

const TRANSIENT_EVALUATE_ERRORS = [
    'Execution context was destroyed',
    'Target page, context or browser has been closed',
    'Unable to find context',
];

export function isTransientEvaluateError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return TRANSIENT_EVALUATE_ERRORS.some((part) => message.includes(part));
}

export async function evaluateInMainProcess<T>(
    app: ElectronApplication,
    pageFunction: () => T,
    options: {timeoutMs?: number; retryDelayMs?: number} = {},
): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const retryDelayMs = options.retryDelayMs ?? 100;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            return await app.evaluate(pageFunction);
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
