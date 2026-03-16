// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {triggerTestNotification, verifyNotificationRecievedinDM} from './helpers';

import {test, expect} from '../../fixtures/index';
import {loginToMattermost} from '../../helpers/login';

test.describe('Trigger Notification From desktop', () => {
    test('should receive a notification on macOS', {tag: ['@P2', '@all', '@darwin']}, async ({electronApp, serverMap}) => {
        if (process.platform !== 'darwin') {
            test.skip(true, 'This test is only for macOS');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[Object.keys(serverMap)[0]]?.[0]?.win;
        if (!firstServer) {
            test.skip(true, 'No server view available');
            return;
        }

        await loginToMattermost(firstServer);
        const textbox = await firstServer.waitForSelector('#post_textbox');
        await textbox.focus();

        // Get the initial badge value
        const beforeBadgeValue = await electronApp.evaluate(async ({app}) => {
            const badge = (app as any).dock.getBadge();
            return badge === '' || isNaN(badge) ? 0 : parseInt(badge, 10);
        });

        // Trigger the notification
        await triggerTestNotification(firstServer);

        // Get the badge value after the notification
        const afterBadgeValue = await electronApp.evaluate(async ({app}) => {
            const badge = (app as any).dock.getBadge();
            return badge === '' || isNaN(badge) ? 0 : parseInt(badge, 10);
        });

        // Assert the badge value increments by 1
        const expectedBadgeValue = beforeBadgeValue + 1;
        expect(afterBadgeValue).toBe(expectedBadgeValue);

        // Verify notification received in DM
        await verifyNotificationRecievedinDM(firstServer, afterBadgeValue);
    });
});
