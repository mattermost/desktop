// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import type {BadgeTestState} from 'src/main/e2e/badgeState';
import type {E2eGlobalRefs} from 'src/main/e2e/hooks';

import {evaluateInMainProcess, evaluateInMainProcessWithArg} from './testRefs';

export type OsBadgeState = {
    count: number;
    symbol: 'mention' | 'unread' | 'expired' | 'none';
    hasOverlay: boolean;
};

export async function waitForBadgeInfrastructure(app: ElectronApplication): Promise<void> {
    await expect.poll(
        async () => app.evaluate(() => {
            const e2eTestRefsKey = '__e2eTestRefs';
            const refs = (global as Record<string, unknown>)[e2eTestRefsKey] as E2eGlobalRefs | undefined;
            return Boolean(refs?.AppState && refs?.ServerManager);
        }),
        {timeout: 30_000, message: 'AppState and ServerManager must be exposed on __e2eTestRefs'},
    ).toBe(true);
}

export async function setUnreadBadgeSetting(app: ElectronApplication, enabled: boolean): Promise<void> {
    await evaluateInMainProcessWithArg(app, (_electron, showUnreadBadge) => {
        const e2eTestRefsKey = '__e2eTestRefs';
        const refs = (global as Record<string, unknown>)[e2eTestRefsKey] as E2eGlobalRefs | undefined;
        if (!refs?.setUnreadBadgeSetting) {
            throw new Error('setUnreadBadgeSetting missing from __e2eTestRefs');
        }
        refs.Config?.set?.('showUnreadBadge', showUnreadBadge);
        refs.setUnreadBadgeSetting(showUnreadBadge);
    }, enabled);
}

export async function updateServerBadgeViaAppState(
    app: ElectronApplication,
    serverName: string,
    mentions: number,
    unreads: boolean,
): Promise<void> {
    await evaluateInMainProcessWithArg(app, (_electron, {serverName: name, mentions: mentionCount, unreads: hasUnreads}) => {
        const e2eTestRefsKey = '__e2eTestRefs';
        const refs = (global as Record<string, unknown>)[e2eTestRefsKey] as E2eGlobalRefs | undefined;
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
    await evaluateInMainProcessWithArg(app, (_electron, {serverName: name, expired: isExpired}) => {
        const e2eTestRefsKey = '__e2eTestRefs';
        const refs = (global as Record<string, unknown>)[e2eTestRefsKey] as E2eGlobalRefs | undefined;
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
    await evaluateInMainProcess(app, () => {
        const e2eTestRefsKey = '__e2eTestRefs';
        const refs = (global as Record<string, unknown>)[e2eTestRefsKey] as E2eGlobalRefs | undefined;
        const AppState = refs?.AppState;
        const ServerManager = refs?.ServerManager;
        if (!AppState || !ServerManager) {
            throw new Error('AppState or ServerManager missing from __e2eTestRefs');
        }
        for (const server of ServerManager.getAllServers()) {
            AppState.updateUnreadsAndMentionsPerServer(server.id, 0, false);
            AppState.updateExpired(server.id, false);
        }
        refs.Config?.set?.('showUnreadBadge', false);
        refs.setUnreadBadgeSetting?.(false);
    });
}

/**
 * Clear all servers and set one server's badge state in a single main-process
 * turn so external AppState updates cannot land between separate clear/set IPC calls.
 */
export async function prepareServerBadgeViaAppState(
    app: ElectronApplication,
    serverName: string,
    mentions: number,
    unreads: boolean,
    options: {enableUnreadBadge?: boolean} = {},
): Promise<void> {
    const {enableUnreadBadge = false} = options;
    await evaluateInMainProcessWithArg(app, (_, payload) => {
        const e2eTestRefsKey = '__e2eTestRefs';
        const refs = (global as Record<string, unknown>)[e2eTestRefsKey] as E2eGlobalRefs | undefined;
        const AppState = refs?.AppState;
        const ServerManager = refs?.ServerManager;
        if (!AppState || !ServerManager) {
            throw new Error('AppState or ServerManager missing from __e2eTestRefs');
        }

        for (const server of ServerManager.getAllServers()) {
            AppState.updateUnreadsAndMentionsPerServer(server.id, 0, false);
            AppState.updateExpired(server.id, false);
        }
        refs.Config?.set?.('showUnreadBadge', payload.enableUnreadBadge);
        refs.setUnreadBadgeSetting?.(payload.enableUnreadBadge);

        const server = ServerManager.getAllServers().find((s: {name: string}) => s.name === payload.serverName);
        if (!server) {
            throw new Error(`Server not found: ${payload.serverName}`);
        }
        AppState.updateUnreadsAndMentionsPerServer(server.id, payload.mentions, payload.unreads);
    }, {serverName, mentions, unreads, enableUnreadBadge});
}

export async function refreshBadgeStateForTest(app: ElectronApplication): Promise<void> {
    await evaluateInMainProcess(app, () => {
        const e2eTestRefsKey = '__e2eTestRefs';
        const refs = (global as Record<string, unknown>)[e2eTestRefsKey] as E2eGlobalRefs | undefined;
        refs?.AppState?.emitStatus();
    });
}

export async function readOsBadge(electronApp: ElectronApplication): Promise<OsBadgeState> {
    return evaluateInMainProcess(electronApp, ({app}) => {
        const testBadgeStateKey = '__testBadgeState';
        const testState = (global as Record<string, unknown>)[testBadgeStateKey] as BadgeTestState | undefined;

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
            let count: number;
            if (app.isUnityRunning()) {
                count = app.getBadgeCount();
            } else if (testState) {
                count = testState.mentionCount + (testState.sessionExpired ? 1 : 0);
            } else {
                count = 0;
            }
            const symbol = testState?.resolvedType ?? (count > 0 ? 'mention' : 'none');
            return {count, symbol, hasOverlay: false};
        }

        // Electron exposes setOverlayIcon() but no getOverlayIcon(); __testBadgeState
        // records what showBadgeWindows() decided to pass to setOverlayIcon().
        const symbol = testState?.resolvedType ?? 'none';
        return {
            count: testState?.mentionCount ?? 0,
            symbol,
            hasOverlay: testState?.hasOverlay ?? false,
        };
    });
}

export async function readBadgeCount(app: ElectronApplication): Promise<number> {
    const state = await readOsBadge(app);
    return state.count;
}
