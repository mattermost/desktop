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
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        await firstServer.waitForSelector('#sidebarItem_off-topic');
        // click on Off topic channel
        await firstServer.click('#sidebarItem_off-topic');
        // click on town square channel
        await firstServer.click('#sidebarItem_town-square');
        await firstServer.locator('[aria-label="Back"]').click();
        let channelHeaderText = await firstServer.$eval('#channelHeaderTitle', (el) => el.firstChild.innerHTML);
        channelHeaderText.should.equal('Off-Topic');
        await firstServer.locator('[aria-label="Forward"]').click();
        channelHeaderText = await firstServer.$eval('#channelHeaderTitle', (el) => el.firstChild.innerHTML);
        channelHeaderText.should.equal('Town Square');
    });
});
