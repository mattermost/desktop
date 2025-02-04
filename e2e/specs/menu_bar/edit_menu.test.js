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
    let firstServer;

    before(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
        firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;

        await env.loginToMattermost(firstServer);
    });

    after(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    it('MM-T807 Undo in the Menu Bar', async () => {
        // click on sint channel
        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        await firstServer.click('#post_textbox');
        robot.keyTap('z', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        const content = await firstServer.inputValue('#post_textbox');
        content.should.be.equal('Mattermos');
    });

    it('MM-T808 Redo in the Menu Bar', async () => {
        // click on sint channel
        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        await firstServer.click('#post_textbox');
        robot.keyTap('z', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        const textAfterUndo = await firstServer.inputValue('#post_textbox');
        textAfterUndo.should.be.equal('Mattermos');
        await firstServer.click('#post_textbox');
        robot.keyTap('z', ['shift', env.cmdOrCtrl]);
        await asyncSleep(1000);
        const content = await firstServer.inputValue('#post_textbox');
        content.should.be.equal('Mattermost');
    });

    it('MM-T809 Cut in the Menu Bar', async () => {
        // click on sint channel
        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        robot.keyTap('a', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        robot.keyTap('x', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        const content = await firstServer.inputValue('#post_textbox');
        content.should.be.equal('');
    });

    it('MM-T810 Copy in the Menu Bar', async () => {
        // click on sint channel
        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        robot.keyTap('a', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        robot.keyTap('c', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        await firstServer.click('#post_textbox');
        robot.keyTap('v', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        const content = await firstServer.inputValue('#post_textbox');
        content.should.be.equal('MattermostMattermost');
    });

    it('MM-T811 Paste in the Menu Bar', async () => {
        // click on sint channel
        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        robot.keyTap('a', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        robot.keyTap('c', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        robot.keyTap('a', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        robot.keyTap('v', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        const content = await firstServer.inputValue('#post_textbox');
        content.should.be.equal('Mattermost');
    });

    it('MM-T812 Select All in the Menu Bar', async () => {
        // click on sint channel
        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.fill('#post_textbox', 'Mattermost');
        robot.keyTap('a', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        const channelHeaderText = await firstServer.evaluate('window.getSelection().toString()');
        channelHeaderText.should.equal('Mattermost');
    });
});
