// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {evaluateInMainProcessWithArg} from './testRefs';

export type NotificationClickPayload = {
    webContentsId: number;
    channelId: string;
    teamId: string;
    url: string;
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
            ((value: typeof p) => void) | undefined;
        if (!simulate) {
            throw new Error('__e2eSimulateNotificationClick not exposed (NODE_ENV must be test)');
        }
        simulate(p);
    }, payload);
}
