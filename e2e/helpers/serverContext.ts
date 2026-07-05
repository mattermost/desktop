// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {closeOverlayWindowsIfOpen} from './overlayWindows';
import type {ServerEntry, ServerMap} from './serverMap';
import {evaluateInMainProcessWithArg} from './testRefs';

/**
 * Make a specific server WebContentsView the active, focused target for automation
 * and application menu handlers (History, View, Find, etc.).
 *
 * ServerView always executes JS in the target webContentsId, but menu actions and
 * keyboard routing use WebContentsManager.getFocusedView() / TabManager state.
 * Tests flaked when overlays stole focus or the github tab was left active.
 */
export async function activateServerView(
    app: ElectronApplication,
    webContentsId: number,
): Promise<void> {
    await closeOverlayWindowsIfOpen(app);

    await evaluateInMainProcessWithArg(app, ({webContents, BrowserWindow}, id) => {
        const refs = (global as any).__e2eTestRefs;
        if (!refs) {
            throw new Error('__e2eTestRefs is not available');
        }

        const mmView = refs.WebContentsManager.getViewByWebContentsId(id);
        if (!mmView) {
            throw new Error(`No server view registered for webContentsId ${id}`);
        }

        const tabView = refs.ViewManager.getView(mmView.id);
        if (tabView) {
            refs.ServerManager.updateCurrentServer(tabView.serverId);
            refs.TabManager.switchToTab(tabView.id);
        }

        refs.TabManager.focusCurrentTab();

        const wc = webContents.fromId(id);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${id} is not available`);
        }
        wc.focus();

        // Menu handlers read this when the app menu blurs the webContents (macOS/Windows).
        refs.WebContentsManager.focusedWebContentsView = mmView.id;

        const mainWindow = refs.MainWindow.get() ?? BrowserWindow.getAllWindows().find((win) => {
            return !win.isDestroyed() && win.webContents.getURL().includes('index');
        });
        mainWindow?.show();
        mainWindow?.focus();
    }, webContentsId);

    const mainWindow = app.windows().find((window) => {
        try {
            return window.url().includes('index');
        } catch {
            return false;
        }
    });
    if (mainWindow) {
        await mainWindow.bringToFront().catch(() => {});
        await mainWindow.keyboard.press('Escape').catch(() => {});
    }
}

/** @deprecated Use activateServerView — kept for existing imports. */
export const prepareMattermostServerView = activateServerView;

export async function getServerViewUrl(app: ElectronApplication, webContentsId: number): Promise<string> {
    return evaluateInMainProcessWithArg(app, ({webContents}, id) => {
        return webContents.fromId(id)?.getURL() ?? '';
    }, webContentsId);
}

export function getServerEntry(serverMap: ServerMap, serverName: string, tabIndex = 0): ServerEntry {
    const entry = serverMap[serverName]?.[tabIndex];
    if (!entry) {
        throw new Error(`Server "${serverName}" tab ${tabIndex} is not registered in the server map`);
    }
    return entry;
}

export async function activateServerEntry(
    app: ElectronApplication,
    entry: ServerEntry,
): Promise<void> {
    await activateServerView(app, entry.webContentsId);
}

export async function expectServerViewUrl(
    app: ElectronApplication,
    webContentsId: number,
    pattern: RegExp,
    options?: {timeout?: number; message?: string},
): Promise<void> {
    await expect.poll(
        () => getServerViewUrl(app, webContentsId),
        {
            timeout: options?.timeout ?? 15_000,
            message: options?.message ?? `Server view URL must match ${pattern}`,
        },
    ).toMatch(pattern);
}

const SEARCH_INPUT = 'input.search-bar.form-control';

/** Reload the server view through MattermostWebContentsView.reload(), bypassing menu focus routing. */
export async function reloadServerView(app: ElectronApplication, webContentsId: number): Promise<void> {
    await activateServerView(app, webContentsId);
    await evaluateInMainProcessWithArg(app, (_electron, id) => {
        const refs = (global as any).__e2eTestRefs;
        const mmView = refs?.WebContentsManager.getViewByWebContentsId(id);
        if (!mmView) {
            throw new Error(`No server view registered for webContentsId ${id}`);
        }
        mmView.reload(mmView.currentURL);
    }, webContentsId);
}

/** Navigate the server view to an absolute URL and wait for the load to finish. */
export async function loadServerViewUrl(
    app: ElectronApplication,
    webContentsId: number,
    url: string,
): Promise<void> {
    await activateServerView(app, webContentsId);
    await evaluateInMainProcessWithArg(app, ({webContents}, payload) => {
        return new Promise<void>((resolve, reject) => {
            const refs = (global as any).__e2eTestRefs;
            const mmView = refs?.WebContentsManager.getViewByWebContentsId(payload.id);
            const wc = webContents.fromId(payload.id);
            if (!mmView || !wc || wc.isDestroyed()) {
                reject(new Error(`No server view registered for webContentsId ${payload.id}`));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error(`Timed out loading server view URL ${payload.url}`));
            }, 45_000);
            const finish = () => {
                clearTimeout(timeout);
                resolve();
            };

            wc.once('did-finish-load', finish);
            mmView.load(payload.url);
        });
    }, {id: webContentsId, url});
}

/** Open the Mattermost search bar via the server view (Ctrl+Shift+F), bypassing menu focus routing. */
export async function openServerSearch(app: ElectronApplication, webContentsId: number): Promise<void> {
    await activateServerView(app, webContentsId);
    await evaluateInMainProcessWithArg(app, (_electron, id) => {
        const refs = (global as any).__e2eTestRefs;
        const mmView = refs?.WebContentsManager.getViewByWebContentsId(id);
        if (!mmView) {
            throw new Error(`No server view registered for webContentsId ${id}`);
        }
        mmView.openFind();
    }, webContentsId);
}

/** Poll until the search input exists, is visible, and has keyboard focus. */
export async function waitForSearchBarFocused(
    win: import('./serverView').ServerView,
    options?: {timeout?: number},
): Promise<void> {
    const timeout = options?.timeout ?? 30_000;
    await expect.poll(async () => win.runInRenderer(`
        const input = document.querySelector(${JSON.stringify(SEARCH_INPUT)});
        if (!input) {
            return false;
        }
        const rect = input.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }
        if (input !== document.activeElement) {
            input.focus?.();
        }
        return input === document.activeElement;
    `), {timeout, message: 'Search bar must be visible and focused'}).toBe(true);
}

export {SEARCH_INPUT};
