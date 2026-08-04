// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication, Page} from 'playwright';

import {waitForWindow} from './electronApp';
import {clickApplicationMenuItem} from './menu';
import {ServerView} from './serverView';

const POPOUT_URL_FRAGMENT = 'popout.html';

export function getPopoutWindows(app: ElectronApplication): Page[] {
    return app.windows().filter((window) => {
        try {
            return window.url().includes(POPOUT_URL_FRAGMENT);
        } catch {
            return false;
        }
    });
}

export function popoutWindowCount(app: ElectronApplication): number {
    return getPopoutWindows(app).length;
}

function popoutTimeoutMs(): number {
    return process.platform === 'linux' ? 45_000 : 30_000;
}

export async function waitForPopoutWindowEvent(app: ElectronApplication): Promise<Page> {
    return app.waitForEvent('window', {
        timeout: popoutTimeoutMs(),
        predicate: (page) => {
            try {
                return page.url().includes(POPOUT_URL_FRAGMENT);
            } catch {
                return false;
            }
        },
    });
}

export async function waitForPopoutWindow(app: ElectronApplication, extraCount = 1): Promise<Page> {
    const baseline = popoutWindowCount(app);
    let popout: Page | undefined;

    await expect.poll(() => {
        const popouts = getPopoutWindows(app);
        if (popouts.length >= baseline + extraCount) {
            popout = popouts[popouts.length - 1];
        }
        return popouts.length;
    }, {
        timeout: popoutTimeoutMs(),
        message: 'Popout BrowserWindow must appear',
    }).toBe(baseline + extraCount);

    if (!popout) {
        throw new Error('Popout window was not available after wait');
    }

    return popout;
}

export async function openPopoutViaFileMenu(app: ElectronApplication, mainWindow: Page): Promise<Page> {
    await mainWindow.bringToFront().catch(() => {});
    const windowPromise = waitForPopoutWindowEvent(app);
    await clickApplicationMenuItem(app, 'file', {label: 'New Window'});
    const popout = await windowPromise;
    await popout.waitForLoadState('domcontentloaded').catch(() => {});
    return popout;
}

/** Alias used by server_management popout specs. */
export const openPopoutWindow = openPopoutViaFileMenu;

export async function openChannelInNewWindow(app: ElectronApplication, channelPath: string): Promise<Page> {
    const windowPromise = waitForPopoutWindowEvent(app);
    const created = await app.evaluate((_, initialPath) => {
        const refs = (global as any).__e2eTestRefs;
        const serverId = refs?.ServerManager?.getCurrentServerId?.();
        const server = serverId ? refs.ServerManager.getServer(serverId) : undefined;
        if (!server) {
            return false;
        }
        const view = refs.ViewManager.createView(server, 'window', initialPath);
        return Boolean(view);
    }, channelPath);
    expect(created, 'ViewManager must create a window-type view').toBe(true);
    const popout = await windowPromise;
    await popout.waitForLoadState('domcontentloaded').catch(() => {});
    return popout;
}

export async function getCurrentServerId(app: ElectronApplication): Promise<string | undefined> {
    return app.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        return refs?.ServerManager?.getCurrentServerId?.() as string | undefined;
    });
}

export async function getWindowTypeView(app: ElectronApplication) {
    const serverId = await getCurrentServerId(app);
    expect(serverId).toBeTruthy();

    let windowView: {viewId: string; webContentsId: number | null} | null = null;
    await expect.poll(async () => {
        windowView = await app.evaluate((_, sid) => {
            const refs = (global as any).__e2eTestRefs;
            const windowViews = refs.ViewManager.getViewsByServerId(sid).
                filter((view: {type: string}) => view.type === 'window');
            const latest = windowViews[windowViews.length - 1];
            if (!latest) {
                return null;
            }
            const wcView = refs.WebContentsManager.getView(latest.id);
            return {
                viewId: latest.id,
                webContentsId: wcView?.webContentsId ?? null,
            };
        }, serverId!);
        return windowView;
    }, {timeout: 30_000, message: 'Window-type view must register in ViewManager'}).not.toBeNull();

    return windowView!;
}

export async function getPopoutServerView(app: ElectronApplication): Promise<ServerView> {
    const serverId = await getCurrentServerId(app);
    expect(serverId).toBeTruthy();

    let webContentsId: number | null = null;
    await expect.poll(async () => {
        const entries = await app.evaluate((_, sid) => {
            const refs = (global as any).__e2eTestRefs;
            return refs.ViewManager.getViewsByServerId(sid).
                filter((view: {type: string}) => view.type === 'window').
                map((view: {id: string}) => {
                    const wcView = refs.WebContentsManager.getView(view.id);
                    return wcView?.webContentsId ?? null;
                }).
                filter(Boolean);
        }, serverId!);
        webContentsId = (entries as number[])[(entries as number[]).length - 1] ?? null;
        return webContentsId;
    }, {timeout: 30_000, message: 'Popout server view webContents must register'}).not.toBeNull();

    return new ServerView(app, webContentsId!);
}

export async function closePopoutWindow(
    app: ElectronApplication,
    popoutWindow: Page,
    waitForAllClosed = false,
): Promise<void> {
    const browserWindow = await app.browserWindow(popoutWindow);
    const closeTimeout = process.platform === 'linux' ? 5_000 : 15_000;
    await Promise.all([
        popoutWindow.waitForEvent('close', {timeout: closeTimeout}),
        browserWindow.evaluate((w) => (w as Electron.BrowserWindow).close()),
    ]).catch(async () => {
        await browserWindow.evaluate((w) => {
            if (!(w as Electron.BrowserWindow).isDestroyed()) {
                (w as Electron.BrowserWindow).destroy();
            }
        }).catch(() => {});
    });

    if (!waitForAllClosed) {
        return;
    }

    await expect.poll(() => popoutWindowCount(app), {timeout: 10_000}).toBe(0);
}

export async function closeAllPopouts(app: ElectronApplication): Promise<void> {
    const popoutWindows = getPopoutWindows(app);

    for (const popout of popoutWindows) {
        await closePopoutWindow(app, popout, false).catch(() => {});
    }

    if (popoutWindows.length > 0) {
        await expect.poll(() => popoutWindowCount(app), {timeout: 10_000}).toBe(0);
    }
}

type DesktopPopoutOptions = Record<string, unknown>;

async function openPopoutViaDesktopApi(
    win: ServerView,
    app: ElectronApplication,
    popoutPath: string,
    options: DesktopPopoutOptions,
    unavailableMessage: string,
): Promise<void> {
    const windowPromise = waitForPopoutWindowEvent(app);
    const opened = await win.runInRenderer<boolean>(`
        const path = ${JSON.stringify(popoutPath)};
        const options = ${JSON.stringify(options)};
        const api = window.desktopAPI;
        if (!api?.openPopout) {
            return false;
        }
        void api.openPopout(path, options);
        return true;
    `, true);
    expect(opened, unavailableMessage).toBe(true);
    await windowPromise;
}

export async function openRhsPopoutViaDesktopApi(
    win: ServerView,
    app: ElectronApplication,
    channelPath: string,
): Promise<void> {
    await openPopoutViaDesktopApi(
        win,
        app,
        channelPath,
        {isRHS: true},
        'desktopAPI.openPopout must be available in the server view',
    );
}

export async function openThreadPopoutViaDesktopApi(
    win: ServerView,
    app: ElectronApplication,
    threadPath: string,
): Promise<void> {
    await openPopoutViaDesktopApi(
        win,
        app,
        threadPath,
        {},
        'desktopAPI.openPopout must be available for thread popouts',
    );
}

export async function resetTabsAndPopouts(app: ElectronApplication): Promise<Page> {
    await closeAllPopouts(app);
    await app.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        const serverId = refs?.ServerManager?.getCurrentServerId?.();
        if (!serverId) {
            return false;
        }

        const primaryView = refs.ViewManager.getPrimaryView(serverId);
        refs.ViewManager.getViewsByServerId(serverId).forEach((view: {id: string; type: string}) => {
            if (view.id !== primaryView?.id) {
                refs.ViewManager.removeView(view.id);
            } else if (view.type === 'window') {
                refs.ViewManager.updateViewType(view.id, 'tab');
            }
        });

        if (primaryView) {
            refs.TabManager.switchToTab(primaryView.id);
        }
        return true;
    });

    const indexWindow = await waitForWindow(app, 'index');
    await indexWindow.bringToFront().catch(() => {});
    return indexWindow;
}
