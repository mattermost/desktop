// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {triggerTestNotification, verifyNotificationReceivedInDM} from './helpers';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {loginToMattermost} from '../../helpers/login';

// ── MM-T1661: Desktop notifications ────────────────────────────────────
// Drives the real notification path via triggerTestNotification (same helper
// used by notification_badge_in_dock.test.ts). Asserts the observable side
// effect: badge count increments after a test notification is sent.

test.describe('notification_trigger/desktop_notification_delivery', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('MM-T1661 Desktop notifications',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const releaseLock = await acquireExclusiveLock('notification-state');
            try {
                const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
                expect(firstServer, 'Server view must exist').toBeTruthy();

                await loginToMattermost(firstServer!);

                // The notification trigger depends on the Customize Your Experience tour button.
                const tourButton = await firstServer!.$('div#CustomizeYourExperienceTour > button');
                if (!tourButton) {
                    test.skip(true, 'CustomizeYourExperienceTour not available in this server version');
                    return;
                }

                // Read badge count before notification
                const beforeBadge = await electronApp.evaluate(({app}) => {
                    try {
                        const badge = app.getBadgeCount();
                        return badge;
                    } catch {
                        return 0;
                    }
                });

                // Trigger a real desktop notification
                await triggerTestNotification(firstServer!);

                // Badge count must increment
                await expect.poll(
                    () => electronApp.evaluate(({app}) => {
                        try {
                            return app.getBadgeCount();
                        } catch {
                            return 0;
                        }
                    }),
                    {timeout: 10_000, message: 'Badge count must increment after notification'},
                ).toBeGreaterThan(beforeBadge);

                // Verify the notification was received in the DM from system-bot
                await verifyNotificationReceivedInDM(firstServer!);
            } finally {
                await releaseLock();
            }
        },
    );
});
