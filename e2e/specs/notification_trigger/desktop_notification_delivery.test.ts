// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {readBadgeCount} from '../../helpers/badge';
import {demoMattermostConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {loginToMattermost} from '../../helpers/login';

import {triggerTestNotification, verifyNotificationReceivedInDM} from './helpers';

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

                try {
                    await firstServer!.waitForSelector('div#CustomizeYourExperienceTour > button', {timeout: 15_000});
                } catch {
                    test.skip(true, 'CustomizeYourExperienceTour not available in this server version');
                    return;
                }

                const unityRunning = process.platform === 'linux' ?
                    await electronApp.evaluate(({app}) => app.isUnityRunning()) :
                    true;

                const beforeBadge = unityRunning ? await readBadgeCount(electronApp) : 0;

                await triggerTestNotification(firstServer!);

                if (unityRunning && process.platform !== 'win32') {
                    await expect.poll(
                        () => readBadgeCount(electronApp),
                        {timeout: 10_000, message: 'Badge count must increment after notification'},
                    ).toBeGreaterThan(beforeBadge);
                }

                await verifyNotificationReceivedInDM(firstServer!);
            } finally {
                await releaseLock();
            }
        },
    );
});
