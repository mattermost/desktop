// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const {clipboard} = require('electron');
const robot = require('robotjs');

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

    if (process.platform !== 'linux') {
        it('MM-T125 Copy Link can be used from channel LHS', async () => {
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await asyncSleep(2000);
            await firstServer.waitForSelector('#sidebarItem_town-square', {timeout: 5000});
            await firstServer.click('#sidebarItem_town-square', {button: 'right'});
            await asyncSleep(2000);
            switch (process.platform) {
            case 'win32':
                robot.keyTap('down');
                robot.keyTap('down');
                break;
            case 'darwin':
                robot.keyTap('c');
                break;
            }
            robot.keyTap('enter');
            await firstServer.click('#sidebarItem_town-square');
            await firstServer.click('#post_textbox');
            const clipboardText = clipboard.readText();
            clipboardText.should.contain('/channels/town-square');
        });
    }
});
