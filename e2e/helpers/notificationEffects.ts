// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {evaluateInMainProcessWithArg} from './testRefs';

/**
 * Invoke the exported flashFrame() from main/notifications — the same function the
 * notification `show` handler calls, not a copy of it.
 *
 * OS notification delivery is unreliable in headless CI (Electron's Notification
 * often emits `failed` without `show`), so flash_taskbar and dock_bounce tests
 * call that gate directly rather than waiting on a real notification.
 */
export async function triggerNotificationEffects(app: ElectronApplication, flash = true): Promise<void> {
    await evaluateInMainProcessWithArg(app, (_electron, shouldFlash: boolean) => {
        const trigger = (global as any).__e2eNotificationEffects as ((value: boolean) => void) | undefined;
        if (!trigger) {
            throw new Error('__e2eNotificationEffects not exposed (NODE_ENV must be test)');
        }
        trigger(shouldFlash);
    }, flash);
}
