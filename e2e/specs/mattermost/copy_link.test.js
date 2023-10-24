// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const {clipboard} = require('electron');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('copylink', function desc() {
    this.timeout(40000);

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

    it('MM-T125 Copy Link can be used from channel LHS', async () => {
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        await firstServer.waitForSelector('#sidebarItem_town-square');
        await firstServer.click('#sidebarItem_town-square', {button: 'right'});
        await firstServer.click('li.SidebarChannel.expanded.active > span > nav > div');
        await firstServer.click('#sidebarItem_town-square');
        await firstServer.click('#post_textbox');
        const clipboardText = clipboard.readText();
        await firstServer.fill('#post_textbox', clipboardText);
        const content = await firstServer.locator('#post_textbox').textContent();
        content.should.contain('/ad-1/channels/town-square');
    });
});
