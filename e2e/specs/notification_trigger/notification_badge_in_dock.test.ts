// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {triggerTestNotification, verifyNotificationReceivedInDM} from './helpers';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {loginToMattermost} from '../../helpers/login';

test.describe('Trigger Notification From desktop', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('should receive a notification on macOS', {tag: ['@P2', '@darwin']}, async ({electronApp, serverMap}) => {
        if (process.platform !== 'darwin') {
            test.skip(true, 'This test is only for macOS');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const releaseLock = await acquireExclusiveLock('notification-state');
        try {
            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            if (!firstServer) {
                test.skip(true, 'No server view available');
                return;
            }

            await loginToMattermost(firstServer);
            const textbox = await firstServer.waitForSelector('#post_textbox');
            await textbox.focus();

            // The notification trigger depends on the Customize Your Experience tour button.
            // Skip if it's not available in this server version.
            const tourButton = await firstServer.$('div#CustomizeYourExperienceTour > button');
            if (!tourButton) {
                test.skip(true, 'CustomizeYourExperienceTour not available in this server version');
                return;
            }

            const beforeBadgeValue = await electronApp.evaluate(async ({app}) => {
                const badge = (app as any).dock.getBadge();
                return badge === '' || isNaN(badge) ? 0 : parseInt(badge, 10);
            });

            await triggerTestNotification(firstServer);

            await expect.poll(async () => {
                const badge = await electronApp.evaluate(async ({app}) => {
                    const current = (app as any).dock.getBadge();
                    return current === '' || isNaN(current) ? 0 : parseInt(current, 10);
                });
                return badge;
            }, {timeout: 10_000}).toBeGreaterThanOrEqual(beforeBadgeValue + 1);

            await verifyNotificationReceivedInDM(firstServer);
        } finally {
            await releaseLock();
        }
    });
});
