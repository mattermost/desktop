// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {triggerTestNotification, verifyNotificationRecievedinDM} from './helpers';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('Trigger Notification From desktop', function desc() {
    this.timeout(400000);

    const config = env.demoMattermostConfig;
    let firstServer;

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);

        firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        const textbox = await firstServer.waitForSelector('#post_textbox');
        textbox.focus();
    });

    // This support to getBadge is only available for MacOS
    env.shouldTest(it, process.platform === 'darwin')('should receive a notification on macOS', async () => {
        await asyncSleep(2000);

        // Get the initial badge value
        const beforeBadgeValue = await this.app.evaluate(async ({app}) => {
            const badge = app.dock.getBadge();

            // Convert badge to a number, defaulting to 0 if empty or invalid
            return badge === '' || isNaN(badge) ? 0 : parseInt(badge, 10);
        });

        // Trigger the notification
        await triggerTestNotification(firstServer);

        // Get the badge value after the notification
        const afterBadgeValue = await this.app.evaluate(async ({app}) => {
            const badge = app.dock.getBadge();

            // Convert badge to a number, defaulting to 0 if empty or invalid
            return badge === '' || isNaN(badge) ? 0 : parseInt(badge, 10);
        });

        // Assert the badge value increments by 1
        const expectedBadgeValue = beforeBadgeValue + 1;
        afterBadgeValue.should.equal(expectedBadgeValue);

        // Verify notification received in DM
        await verifyNotificationRecievedinDM(firstServer, afterBadgeValue);
    });
});
