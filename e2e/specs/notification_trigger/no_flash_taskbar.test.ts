// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {demoConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {installFlashFrameSpy, restoreFlashFrameSpy} from '../../helpers/methodSpy';
import {triggerNotificationEffects} from '../../helpers/notificationEffects';

test.describe('notification_trigger/no_flash_taskbar', () => {
    test.use({appConfig: demoConfig});
    test.setTimeout(120_000);

    test(
        'MM-T1294 Do not flash taskbar icon — Windows & Linux ONLY',
        {tag: ['@P2', '@win32', '@linux']},
        async ({electronApp}) => {
            await waitForAppReady(electronApp);

            const releaseLock = await acquireExclusiveLock('flash-taskbar-state');
            let originalFlashWindow: number | undefined;
            try {
                originalFlashWindow = await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const Config = refs?.Config;
                    if (!Config) {
                        return undefined;
                    }
                    return Config.notifications?.flashWindow;
                });

                await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const Config = refs?.Config;
                    if (Config) {
                        Config.set('notifications', {...Config.notifications, flashWindow: 0});
                    }
                });

                await installFlashFrameSpy(electronApp);

                try {
                    await triggerNotificationEffects(electronApp, true);

                    await expect.poll(
                        () => electronApp.evaluate(() => (global as any).__e2eFlashFrameCalls ?? []),
                        {timeout: 10_000, message: 'flashFrame(true) must not be called when flashWindow is disabled'},
                    ).not.toContain(true);
                } finally {
                    await restoreFlashFrameSpy(electronApp);
                }

                if (originalFlashWindow !== undefined) {
                    await electronApp.evaluate((flashWindow) => {
                        const refs = (global as any).__e2eTestRefs;
                        const Config = refs?.Config;
                        if (Config) {
                            Config.set('notifications', {...Config.notifications, flashWindow});
                        }
                    }, originalFlashWindow);
                }
            } finally {
                await releaseLock();
            }
        },
    );
});
