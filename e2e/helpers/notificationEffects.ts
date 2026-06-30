// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

/**
 * Invoke the production flashFrame() helper from src/main/notifications/index.ts.
 *
 * OS notification delivery is unreliable in headless CI (Electron's Notification
 * often emits `failed` without `show`), so flash_taskbar and dock_bounce tests
 * exercise the same flashFrame() gate the notification `show` handler calls.
 */
export async function triggerNotificationEffects(app: ElectronApplication, flash = true): Promise<void> {
    await app.evaluate((_, shouldFlash: boolean) => {
        const trigger = (global as any).__e2eNotificationEffects as ((value: boolean) => void) | undefined;
        if (!trigger) {
            throw new Error('__e2eNotificationEffects not exposed (NODE_ENV must be test)');
        }
        trigger(shouldFlash);
    }, flash);
}
