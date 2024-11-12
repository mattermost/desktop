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

        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        const textbox = await firstServer.waitForSelector('#post_textbox');
        textbox.focus();
    });

    // This support to getBadge is only available for MacOS
    env.shouldTest(it, process.platform === 'darwin')('should receive a notification on macOS', async () => {
        await triggerTestNotification(firstServer);
        const badgeValue = await this.app.evaluate(async ({app}) => {
            return app.dock.getBadge();
        });
        badgeValue.should.equal('1');
        await verifyNotificationRecievedinDM(firstServer);
    });
});
