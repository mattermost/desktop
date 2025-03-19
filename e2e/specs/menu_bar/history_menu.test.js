// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('history_menu', function desc() {
    this.timeout(30000);

    const config = env.demoMattermostConfig;

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    it('Click back and forward from history', async () => {
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        await firstServer.waitForSelector('#sidebarItem_off-topic');

        // Click on Off-Topic channel
        await firstServer.click('#sidebarItem_off-topic');

        // Click on Town Square channel
        await firstServer.click('#sidebarItem_town-square');
        await firstServer.locator('[aria-label="Back"]').click();

        // Wait for navigation
        await firstServer.waitForSelector('#channelHeaderTitle');

        // Get channel header text
        let channelHeaderText = await firstServer.$eval('#channelHeaderTitle', (el) => el.textContent.trim());
        channelHeaderText.should.equal('Off-Topic');

        await firstServer.locator('[aria-label="Forward"]').click();
        await asyncSleep(3000);

        // Wait for navigation
        await firstServer.waitForSelector('#channelHeaderTitle');

        channelHeaderText = await firstServer.$eval('#channelHeaderTitle', (el) => el.textContent.trim());
        channelHeaderText.should.equal('Town Square');
    });
});
