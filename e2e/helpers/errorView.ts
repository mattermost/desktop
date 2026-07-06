// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication, Page} from 'playwright';

import {waitForRendererReady} from './badServer';
import {clearCertificateErrorCallbacks} from './dialog';
import {evaluateInMainProcessWithArg, findMainIndexWindow, resolveMainIndexWindow} from './testRefs';

type WaitForErrorViewOptions = {
    serverName?: string;
    timeout?: number;

    /** Set after add-server modal confirm; skip for pre-configured startup configs. */
    waitForActiveServer?: boolean;
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

async function reloadTargetServerViews(
    app: ElectronApplication,
    serverName?: string,
): Promise<void> {
    // On platforms where the initial load fails very fast, the view may never be
    // added to WebContentsManager before this poll's deadline. If no view exists,
    // reload is a no-op and the existing load failure may already be in ErrorView.
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

function resolveErrorViewHost(app: ElectronApplication, fallback: Page): Page {
    return findMainIndexWindow(app) ?? fallback;
}

/**
 * Wait for MainPage to surface a load failure in `.ErrorView` on index.html.
 *
 * ErrorView is rendered in the main BrowserWindow (MainPage → BasePage), not in
 * server WebContentsViews. If LOAD_FAILED fired before MainPage registered IPC
 * listeners, reload the server view so the failure is captured in React state.
 */
export async function waitForErrorView(
    app: ElectronApplication,
    options: WaitForErrorViewOptions = {},
): Promise<Page> {
    const timeout = options.timeout ?? (process.env.CI ? 60_000 : 45_000);
    const {serverName, waitForActiveServer = false} = options;

    const mainWindow = await resolveMainIndexWindow(app, Math.min(timeout, 30_000));
    await waitForRendererReady(mainWindow);

    if (waitForActiveServer && serverName) {
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
            const window = resolveErrorViewHost(app, mainWindow);
            return window.innerText('.ServerDropdownButton').catch(() => '');
        }, {
            timeout: 15_000,
            message: `Active server should switch to ${serverName}`,
        }).toContain(serverName);
    }

    const host = resolveErrorViewHost(app, mainWindow);
    if (!(await host.isVisible('.ErrorView').catch(() => false))) {
        await reloadTargetServerViews(app, serverName);
    }

    await expect.poll(async () => {
        const window = resolveErrorViewHost(app, mainWindow);
        try {
            return await window.isVisible('.ErrorView');
        } catch {
            return false;
        }
    }, {
        timeout,
        message: 'ErrorView did not appear before timeout',
    }).toBe(true);

    return resolveErrorViewHost(app, mainWindow);
}
