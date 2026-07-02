// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {evaluateInMainProcessWithArg} from './testRefs';

export type NotificationClickPayload = {
    webContentsId: number;
    channelId: string;
    teamId: string;
    url: string;
};

export type DisplayMentionPayload = NotificationClickPayload & {
    title: string;
    body: string;
};

/**
 * Invoke the production mention-click handler (NOTIFICATION_CLICKED + focus-on-nav).
 * Does not create an OS notification — use for webapp↔desktop integration smoke tests.
 */
export async function simulateNotificationClick(
    app: ElectronApplication,
    payload: NotificationClickPayload,
): Promise<void> {
    await evaluateInMainProcessWithArg(app, (_electron, p) => {
        const simulate = (global as any).__e2eSimulateNotificationClick as
            | ((value: typeof p) => void)
            | undefined;
        if (!simulate) {
            throw new Error('__e2eSimulateNotificationClick not exposed (NODE_ENV must be test)');
        }
        simulate(p);
    }, payload);
}

/**
 * Display a mention via NotificationManager, poll until it is registered, then click it.
 * Use when a test needs the full display→click path; OS show may still fail in headless CI.
 */
export async function displayMentionAndClick(
    app: ElectronApplication,
    payload: DisplayMentionPayload,
): Promise<void> {
    await evaluateInMainProcessWithArg(app, async ({webContents}, p) => {
        const refs = (global as any).__e2eTestRefs;
        const manager = refs?.NotificationManager;
        if (!manager) {
            throw new Error('__e2eTestRefs.NotificationManager not exposed');
        }

        const wc = webContents.fromId(p.webContentsId);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${p.webContentsId} is not available`);
        }

        await manager.displayMention(
            p.title,
            p.body,
            p.channelId,
            p.teamId,
            p.url,
            true,
            wc,
            '',
        );
    }, payload);

    await expect.poll(async () => {
        try {
            await evaluateInMainProcessWithArg(app, (_electron, channelId) => {
                const clickActive = (global as any).__e2eClickActiveMention as
                    | ((id: string) => void)
                    | undefined;
                if (!clickActive) {
                    throw new Error('__e2eClickActiveMention not exposed (NODE_ENV must be test)');
                }
                clickActive(channelId);
            }, payload.channelId);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('No active mention for channel')) {
                return false;
            }
            throw error;
        }
    }, {
        timeout: 5_000,
        message: 'Active mention must exist after displayMention',
    }).toBe(true);
}
