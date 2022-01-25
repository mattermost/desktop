// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('edit_menu', function desc() {
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
    });

    it('MM-T807 Undo in the Menu Bar', async () => {
        if (process.platform === 'win32' || process.platform === 'linux') {
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#sidebarItem_suscipit-4');

            // click on sint channel
            await firstServer.click('#sidebarItem_suscipit-4');
            await firstServer.click('#post_textbox');
            await firstServer.fill('#post_textbox', 'Mattermost');
            await firstServer.click('#post_textbox');
            robot.keyTap('alt');
            robot.keyTap('enter');
            robot.keyTap('e');
            robot.keyTap('u');
            robot.keyTap('enter');
            const content = await firstServer.locator('#post_textbox').textContent();
            content.should.be.equal('Mattermos');
        }
    });
});
