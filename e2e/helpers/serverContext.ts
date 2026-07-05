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
