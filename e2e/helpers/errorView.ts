// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {clearCertificateErrorCallbacks} from './dialog';
import {evaluateInMainProcessWithArg, isTransientEvaluateError, resolveMainIndexWindow} from './testRefs';

type WaitForErrorViewOptions = {
    serverName?: string;
    timeout?: number;
};

type ServerReloadAction = 'checkRegistered' | 'reload' | 'checkLoading';

/**
 * Single main-process callback for the three server-reload polls below, so the
 * "filter servers by name → get views → get WebContentsManager entry" traversal
 * is written once instead of once per poll. `action` picks which step to run;
 * this has to stay one function (rather than three) because Playwright serializes
 * whatever function is passed to `evaluate` — helpers defined elsewhere in this
 * module aren't reachable from inside it.
 *
 * NOTE: Playwright's ElectronApplication.evaluate(fn, arg) always passes the
 * `electron` module as the FIRST argument to `fn`. The user-supplied `arg` is the
 * SECOND argument. Hence the `(_electron, payload)` signature below.
 */
async function evaluateServerReloadState(
    app: ElectronApplication,
    action: ServerReloadAction,
    targetServerName?: string,
): Promise<boolean> {
    return evaluateInMainProcessWithArg(app, (_electron, payload) => {
        const refs = (global as any).__e2eTestRefs;
        if (!refs) {
            return payload.action === 'checkLoading';
        }

        const servers: Array<{id: string; name: string}> = refs.ServerManager.getAllServers();
        const targets = payload.targetServerName ?
            servers.filter((server) => server.name === payload.targetServerName) :
            servers;

        if (payload.action === 'checkRegistered') {
            return targets.length > 0;
        }

        const getWebContentsEntries = () => {
            const entries: any[] = [];
            for (const server of targets) {
                const views: Array<{id: string}> = refs.ViewManager.getViewsByServerId(server.id);
                for (const view of views) {
                    const wcEntry = refs.WebContentsManager.getView(view.id);
                    if (wcEntry) {
                        entries.push(wcEntry);
                    }
                }
            }
            return entries;
        };

        if (payload.action === 'reload') {
            for (const wcEntry of getWebContentsEntries()) {
                wcEntry.reload?.();
            }
            return true;
        }

        // checkLoading
        return getWebContentsEntries().every((wcEntry) => !wcEntry.webContents?.isLoading?.());
    }, {action, targetServerName});
}

/**
 * Wait for the renderer to mount, then reload server views so load failures
 * that fired before IPC listeners were registered are surfaced in ErrorView.
 */
export async function waitForRendererThenReload(
    app: ElectronApplication,
    serverName?: string,
): Promise<void> {
    let mainWindow;
    try {
        mainWindow = await resolveMainIndexWindow(app);
    } catch {
        return;
    }

    await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 15_000}).catch(() => {});

    if (serverName) {
        await expect.poll(() => {
            return !app.windows().some((window) => {
                try {
                    return window.url().includes('newServer');
                } catch {
                    return false;
                }
            });
        }, {timeout: 10_000, message: 'Add server modal should close after confirm'}).toBe(true);

        await expect.poll(async () => {
            return mainWindow.innerText('.ServerDropdownButton');
        }, {timeout: 10_000, message: `Active server should switch to ${serverName}`}).toContain(serverName);
    }

    // Wait until ServerManager knows about the target server. We intentionally do NOT
    // require a WebContentsManager entry to exist here: on platforms where the initial
    // load fails very fast (e.g. expired cert at startup), the view may never be added
    // to WebContentsManager before this poll's deadline. If no view exists, the reload
    // step below becomes a no-op and the existing load failure already surfaces in
    // `.ErrorView`, which is what the caller is polling for.
    await expect.poll(
        () => evaluateServerReloadState(app, 'checkRegistered', serverName),
        {timeout: 15_000, message: 'Target server should be registered before reload'},
    ).toBe(true);

    await clearCertificateErrorCallbacks(app).catch(() => {});

    await evaluateServerReloadState(app, 'reload', serverName);

    await expect.poll(
        () => evaluateServerReloadState(app, 'checkLoading', serverName),
        {timeout: 15_000, message: 'Server views should finish reloading after renderer is ready'},
    ).toBe(true);
}

/**
 * Only DOM-not-ready-yet failures (missing window, missing selector, transient
 * evaluate errors) should be retried here. A real programming error — a bad ref,
 * a renamed method, a typo — should fail immediately instead of being retried
 * away for up to a minute and reported as a generic "ErrorView did not appear".
 */
function isRetryableErrorViewFailure(error: unknown): boolean {
    if (isTransientEvaluateError(error)) {
        return true;
    }
    if (error instanceof TypeError || error instanceof ReferenceError) {
        return false;
    }
    if (error instanceof Error && error.message.startsWith('__e2eTestRefs.')) {
        return false;
    }
    return true;
}

export async function waitForErrorView(
    app: ElectronApplication,
    options: WaitForErrorViewOptions = {},
): Promise<void> {
    const timeout = options.timeout ?? (process.env.CI ? 60_000 : 45_000);
    const deadline = Date.now() + timeout;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            const mainWindow = await resolveMainIndexWindow(
                app,
                Math.min(30_000, Math.max(deadline - Date.now(), 1_000)),
            );
            await waitForRendererThenReload(app, options.serverName);
            await mainWindow.waitForSelector('.ErrorView', {
                timeout: Math.min(10_000, deadline - Date.now()),
            });
            return;
        } catch (error) {
            if (!isRetryableErrorViewFailure(error)) {
                throw error;
            }
            lastError = error;
            await clearCertificateErrorCallbacks(app).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    throw lastError instanceof Error ? lastError : new Error('ErrorView did not appear before timeout');
}
