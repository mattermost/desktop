// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

export type OsBadgeState = {
    count: number;
    symbol: 'mention' | 'unread' | 'expired' | 'none';
    hasOverlay: boolean;
};

export async function waitForBadgeInfrastructure(app: ElectronApplication): Promise<void> {
    await expect.poll(
        async () => app.evaluate(() => {
            const refs = (global as any).__e2eTestRefs;
            return Boolean(refs?.AppState && refs?.ServerManager);
        }),
        {timeout: 30_000, message: 'AppState and ServerManager must be exposed on __e2eTestRefs'},
    ).toBe(true);
}

export async function setUnreadBadgeSetting(app: ElectronApplication, enabled: boolean): Promise<void> {
    await app.evaluate((showUnreadBadge) => {
        const setUnread = (global as any).__testTriggerSetUnreadBadgeSetting;
        if (typeof setUnread !== 'function') {
            throw new Error('__testTriggerSetUnreadBadgeSetting is not registered');
        }
        setUnread(showUnreadBadge);
    }, enabled);
}

export async function updateServerBadgeViaAppState(
    app: ElectronApplication,
    serverName: string,
    mentions: number,
    unreads: boolean,
): Promise<void> {
    await app.evaluate((_electron, {serverName: name, mentions: mentionCount, unreads: hasUnreads}) => {
        const refs = (global as any).__e2eTestRefs;
        const AppState = refs?.AppState;
        const ServerManager = refs?.ServerManager;
        if (!AppState || !ServerManager) {
            throw new Error('AppState or ServerManager missing from __e2eTestRefs');
        }
        const server = ServerManager.getAllServers().find((s: {name: string}) => s.name === name);
        if (!server) {
            throw new Error(`Server not found: ${name}`);
        }
        AppState.updateUnreadsAndMentionsPerServer(server.id, mentionCount, hasUnreads);
    }, {serverName, mentions, unreads});
}

export async function setServerExpiredViaAppState(
    app: ElectronApplication,
    serverName: string,
    expired: boolean,
): Promise<void> {
    await app.evaluate((_electron, {serverName: name, expired: isExpired}) => {
        const refs = (global as any).__e2eTestRefs;
        const AppState = refs?.AppState;
        const ServerManager = refs?.ServerManager;
        if (!AppState || !ServerManager) {
            throw new Error('AppState or ServerManager missing from __e2eTestRefs');
        }
        const server = ServerManager.getAllServers().find((s: {name: string}) => s.name === name);
        if (!server) {
            throw new Error(`Server not found: ${name}`);
        }
        AppState.updateExpired(server.id, isExpired);
    }, {serverName, expired});
}

export async function clearAllBadgesViaAppState(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        const AppState = refs?.AppState;
        const ServerManager = refs?.ServerManager;
        if (!AppState || !ServerManager) {
            throw new Error('AppState or ServerManager missing from __e2eTestRefs');
        }
        for (const server of ServerManager.getAllServers()) {
            AppState.updateUnreadsAndMentionsPerServer(server.id, 0, false);
            AppState.updateExpired(server.id, false);
        }
        const setUnread = (global as any).__testTriggerSetUnreadBadgeSetting;
        if (typeof setUnread === 'function') {
            setUnread(false);
        }
    });
}

export async function readOsBadge(electronApp: ElectronApplication): Promise<OsBadgeState> {
    return electronApp.evaluate(() => {
        const {app} = require('electron') as typeof import('electron');
        const refs = (global as any).__e2eTestRefs;
        const mainWindow = refs?.MainWindow?.get?.();
        const testState = (global as any).__testBadgeState;

        if (process.platform === 'darwin') {
            const badge = app.dock?.getBadge() ?? '';
            if (badge === '•') {
                return {count: 0, symbol: 'unread' as const, hasOverlay: false};
            }
            if (badge === '!') {
                return {count: 0, symbol: 'expired' as const, hasOverlay: false};
            }
            if (badge === '') {
                return {count: 0, symbol: 'none' as const, hasOverlay: false};
            }
            return {count: parseInt(badge, 10), symbol: 'mention' as const, hasOverlay: false};
        }

        if (process.platform === 'linux') {
            // app.getBadgeCount()/setBadgeCount() are no-ops without a running Unity
            // desktop (true in headless CI), so fall back to re-deriving the count
            // from the same inputs showBadgeLinux() would have passed to
            // setBadgeCount() — mentionCount plus 1 for an expired session.
            const count = app.isUnityRunning() ?
                app.getBadgeCount() :
                (testState ? testState.mentionCount + (testState.sessionExpired ? 1 : 0) : 0);
            const symbol = testState?.resolvedType ?? (count > 0 ? 'mention' : 'none');
            return {count, symbol, hasOverlay: false};
        }

        const overlay = mainWindow?.getOverlayIcon?.()?.[0];
        const hasOverlay = Boolean(overlay && !overlay.isEmpty());
        const symbol = testState?.resolvedType ?? (hasOverlay ? 'mention' : 'none');
        return {
            count: testState?.mentionCount ?? (hasOverlay ? 1 : 0),
            symbol,
            hasOverlay,
        };
    });
}

export async function readBadgeCount(app: ElectronApplication): Promise<number> {
    const state = await readOsBadge(app);
    return state.count;
}
