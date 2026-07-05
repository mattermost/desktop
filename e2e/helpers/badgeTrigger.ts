// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

export type BadgeState = {
    mentionCount: number;
    sessionExpired: boolean;
    showUnreadBadge: boolean;
    resolvedType?: string;
} | null;

export async function triggerBadge(
    app: ElectronApplication,
    sessionExpired: boolean,
    mentionCount: number,
    showUnreadBadge: boolean,
): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            const isReady = await app.evaluate(() => typeof (global as any).__testTriggerBadge === 'function');
            if (isReady) {
                break;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('Execution context was destroyed') && !msg.includes('Unable to find context')) {
                throw err;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await app.evaluate((_, args: {sessionExpired: boolean; mentionCount: number; showUnreadBadge: boolean}) => {
        const trigger = (global as any).__testTriggerBadge;
        if (typeof trigger !== 'function') {
            throw new Error('__testTriggerBadge is not registered');
        }
        trigger(args.sessionExpired, args.mentionCount, args.showUnreadBadge);
    }, {sessionExpired, mentionCount, showUnreadBadge});

    if (process.platform === 'win32') {
        await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

export async function getBadgeState(app: ElectronApplication): Promise<BadgeState> {
    return app.evaluate(() => (global as any).__testBadgeState || null);
}

export async function setUnreadBadgeSetting(app: ElectronApplication, enabled: boolean): Promise<void> {
    await app.evaluate((_, value: boolean) => {
        const trigger = (global as any).__testTriggerSetUnreadBadgeSetting;
        if (typeof trigger !== 'function') {
            throw new Error('__testTriggerSetUnreadBadgeSetting is not registered');
        }
        trigger(value);
    }, enabled);
}

export async function waitForBadgeHooks(app: ElectronApplication): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        try {
            const isReady = await app.evaluate(
                () => typeof (global as any).__testTriggerSetUnreadBadgeSetting === 'function',
            );
            if (isReady) {
                return;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('Execution context was destroyed') && !msg.includes('Unable to find context')) {
                throw err;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('Badge test hooks did not register before deadline');
}
