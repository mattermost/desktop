// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {dismissBlockingOverlays} from './blockingOverlays';
import {
    channelItemSelector,
    HAS_CLIENT_JS_ERROR_JS,
    IS_CHANNEL_VIEW_LOADED_JS,
    IS_COMPOSER_INTERACTIVE_JS,
} from './rendererUtils';
import {activateServerView, loadServerViewUrl} from './serverContext';
import {resolveChannelByName} from './server_api/channel';
import type {ServerEntry} from './serverMap';
import type {ServerView} from './serverView';

export type PrepareInteractiveChannelOptions = {
    channelName?: string;
    channelItem?: string;
    timeout?: number;
    recover?: boolean;
};

function resolveChannelItem(options?: {channelName?: string; channelItem?: string}): string {
    if (options?.channelItem) {
        return options.channelItem;
    }
    if (options?.channelName) {
        return channelItemSelector(options.channelName);
    }
    return channelItemSelector('town-square');
}

function resolveChannelName(channelItem: string, explicitName?: string): string {
    if (explicitName) {
        return explicitName;
    }
    const match = channelItem.match(/#sidebarItem_(.+)$/);
    if (!match) {
        throw new Error('channelName is required when channelItem is not a #sidebarItem_ selector');
    }
    return match[1];
}

export async function isComposerInteractive(win: ServerView): Promise<boolean> {
    return win.runInRenderer<boolean>(`return (${IS_COMPOSER_INTERACTIVE_JS});`).catch(() => false);
}

export async function isChannelViewLoaded(win: ServerView): Promise<boolean> {
    return win.runInRenderer<boolean>(`return (${IS_CHANNEL_VIEW_LOADED_JS});`).catch(() => false);
}

/** @deprecated Use isChannelViewLoaded — kept for existing imports. */
export async function isChannelPostListLoaded(win: ServerView): Promise<boolean> {
    return isChannelViewLoaded(win);
}

export async function isOnChannelUrl(win: ServerView, channelName: string): Promise<boolean> {
    return win.runInRenderer<boolean>(`
        return window.location.pathname.includes('/channels/${channelName}');
    `).catch(() => false);
}

/** Wait until the Mattermost sidebar exposes the target channel item. */
export async function waitForMattermostShell(
    win: ServerView,
    options?: {channelItem?: string; channelName?: string; timeout?: number},
): Promise<void> {
    const channelItem = resolveChannelItem(options);
    const timeout = options?.timeout ?? 60_000;

    await expect.poll(async () => {
        try {
            await win.waitForSelector(channelItem, {timeout: 2_000});
            return true;
        } catch {
            return false;
        }
    }, {timeout, message: `Mattermost shell must expose ${channelItem}`}).toBe(true);
}

async function loadChannelByName(win: ServerView, channelName: string): Promise<void> {
    const channel = await resolveChannelByName(channelName);
    await loadServerViewUrl(win.app, win.webContentsId, channel.url);
    await activateServerView(win.app, win.webContentsId);
}

/**
 * Recover a stuck server view: main-process navigation, sidebar click, then reload.
 */
export async function recoverInteractiveChannel(
    win: ServerView,
    options?: {channelItem?: string; channelName?: string; timeout?: number},
): Promise<void> {
    if (await isChannelViewLoaded(win)) {
        return;
    }

    const channelItem = resolveChannelItem(options);
    const channelName = resolveChannelName(channelItem, options?.channelName);
    const shellTimeout = Math.max(Math.floor((options?.timeout ?? 60_000) / 2), 2_000);

    await loadChannelByName(win, channelName);
    await waitForMattermostShell(win, {channelItem, channelName, timeout: shellTimeout});

    if (await isChannelViewLoaded(win)) {
        return;
    }

    await win.click(channelItem).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (await isChannelViewLoaded(win)) {
        return;
    }

    await loadChannelByName(win, channelName);
    await waitForMattermostShell(win, {channelItem, channelName, timeout: shellTimeout});
}

/** @deprecated Use recoverInteractiveChannel. */
export const recoverChannelViewIfNeeded = recoverInteractiveChannel;

/** @deprecated Use recoverInteractiveChannel. */
export const recoverServerViewIfNeeded = recoverInteractiveChannel;

export async function waitForInteractiveChannel(
    win: ServerView,
    options?: PrepareInteractiveChannelOptions,
): Promise<void> {
    const timeout = options?.timeout ?? 30_000;
    const recover = options?.recover ?? true;
    const pollStart = Date.now();
    const recoveryAt = pollStart + Math.min(timeout / 2, 10_000);
    let recovered = false;

    await expect.poll(async () => {
        if (recover && !recovered && Date.now() >= recoveryAt) {
            recovered = true;
            const remaining = Math.max(timeout - (Date.now() - pollStart), 2_000);
            await recoverInteractiveChannel(win, {...options, timeout: remaining});
        }
        return isChannelViewLoaded(win);
    }, {timeout, message: 'Channel must become interactive'}).toBe(true);
}

/**
 * Activate the server view, dismiss overlays, optionally navigate, and wait until
 * the channel composer is interactive.
 */
export async function prepareInteractiveChannel(
    app: ElectronApplication,
    entry: Pick<ServerEntry, 'win' | 'webContentsId'>,
    options?: PrepareInteractiveChannelOptions,
): Promise<void> {
    const channelItem = resolveChannelItem(options);
    const channelName = resolveChannelName(channelItem, options?.channelName);
    const recover = options?.recover ?? true;
    const timeout = options?.timeout ?? 30_000;

    await activateServerView(app, entry.webContentsId);
    await dismissBlockingOverlays(entry.win);

    const needsNavigation = options?.channelName && !(await isOnChannelUrl(entry.win, channelName));
    const hasJsError = await entry.win.runInRenderer<boolean>(`return (${HAS_CLIENT_JS_ERROR_JS});`).catch(() => false);

    if (needsNavigation || (recover && hasJsError && !(await isChannelViewLoaded(entry.win)))) {
        await loadChannelByName(entry.win, channelName);
        await activateServerView(app, entry.webContentsId);
        await dismissBlockingOverlays(entry.win);
    }

    if (recover && !(await isChannelViewLoaded(entry.win))) {
        await recoverInteractiveChannel(entry.win, {channelItem, channelName});
    }

    await waitForInteractiveChannel(entry.win, {channelItem, channelName, timeout, recover});
}

/** @deprecated Use prepareInteractiveChannel or waitForInteractiveChannel. */
export async function ensureChannelReady(
    win: ServerView,
    options?: {channelItem?: string; channelName?: string},
): Promise<void> {
    await prepareInteractiveChannel(win.app, {win, webContentsId: win.webContentsId}, options);
}

/** Wait for sidebar shell, recover if needed, then wait for an interactive channel. */
export async function waitForMattermostShellReady(
    win: ServerView,
    options?: {channelItem?: string; channelName?: string; timeout?: number},
): Promise<void> {
    const timeout = options?.timeout ?? 60_000;
    await waitForMattermostShell(win, {...options, timeout});
    if (!(await isChannelViewLoaded(win))) {
        const remaining = Math.max(timeout - 2_000, 2_000);
        await recoverInteractiveChannel(win, {...options, timeout: remaining});
        await waitForInteractiveChannel(win, {...options, timeout: remaining, recover: false});
    }
}

/** @deprecated Use waitForInteractiveChannel. */
export const waitForChannelPostListLoaded = waitForInteractiveChannel;
