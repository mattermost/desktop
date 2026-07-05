// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {triggerTestNotification} from '../notification_trigger/helpers';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

test.describe('permissions/desktop_notification', () => {
    test.use({appConfig: demoMattermostConfig});

    test(
        'MM-T1303 Receive a desktop notification',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            await electronApp.evaluate(() => {
                (global as any).__e2eNotificationShown = false;
                const refs = (global as any).__e2eTestRefs;
                const originalShow = refs?.NotificationManager?.show?.bind(refs.NotificationManager);
                if (originalShow) {
                    refs.NotificationManager.show = (...args: unknown[]) => {
                        (global as any).__e2eNotificationShown = true;
                        return originalShow(...args);
                    };
                    (global as any).__e2eRestoreNotificationShow = originalShow;
                }
            });

            try {
                const serverWin = serverMap[demoMattermostConfig.servers[0].name][0].win;
                await loginToMattermost(serverWin);
                await triggerTestNotification(serverWin);

                await expect.poll(
                    () => electronApp.evaluate(() => Boolean((global as any).__e2eNotificationShown)),
                    {timeout: 15_000},
                ).toBe(true);
            } finally {
                await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const original = (global as any).__e2eRestoreNotificationShow;
                    if (original && refs?.NotificationManager) {
                        refs.NotificationManager.show = original;
                    }
                });
            }
        },
    );
});
