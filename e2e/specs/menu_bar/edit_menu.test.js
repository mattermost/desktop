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
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#sidebarItem_suscipit-4');

            // click on sint channel
            await firstServer.click('#sidebarItem_suscipit-4');
            await firstServer.click('#post_textbox');
            await firstServer.type('#post_textbox', 'Mattermost');
            await firstServer.click('#post_textbox');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('u');
            const content = await firstServer.inputValue('#post_textbox');
            content.should.be.equal('Mattermos');
        }
    });

    it('MM-T808 Redo in the Menu Bar', async () => {
        if (process.platform === 'win32' || process.platform === 'linux') {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#sidebarItem_suscipit-4');

            // click on sint channel
            await firstServer.click('#sidebarItem_suscipit-4');
            await firstServer.click('#post_textbox');
            await firstServer.type('#post_textbox', 'Mattermost');
            await firstServer.click('#post_textbox');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('u');
            const textAfterUndo = await firstServer.inputValue('#post_textbox');
            textAfterUndo.should.be.equal('Mattermos');
            await firstServer.click('#post_textbox');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('r');
            const content = await firstServer.inputValue('#post_textbox');
            content.should.be.equal('Mattermost');
        }
    });

    it('MM-T809 Cut in the Menu Bar', async () => {
        if (process.platform === 'win32' || process.platform === 'linux') {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#sidebarItem_suscipit-4');

            // click on sint channel
            await firstServer.click('#sidebarItem_suscipit-4');
            await firstServer.click('#post_textbox');
            await firstServer.type('#post_textbox', 'Mattermost');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('s');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('c');
            robot.keyTap('enter');
            const content = await firstServer.inputValue('#post_textbox');
            content.should.be.equal('');
        }
    });

    it('MM-T810 Copy in the Menu Bar', async () => {
        if (process.platform === 'win32' || process.platform === 'linux') {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#sidebarItem_suscipit-4');

            // click on sint channel
            await firstServer.click('#sidebarItem_suscipit-4');
            await firstServer.click('#post_textbox');
            await firstServer.type('#post_textbox', 'Mattermost');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('s');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('c');
            robot.keyTap('c');
            robot.keyTap('enter');
            await firstServer.click('#post_textbox');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('p');
            robot.keyTap('enter');
            const content = await firstServer.inputValue('#post_textbox');
            content.should.be.equal('MattermostMattermost');
        }
    });

    it('MM-T811 Paste in the Menu Bar', async () => {
        if (process.platform === 'win32' || process.platform === 'linux') {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#sidebarItem_suscipit-4');

            // click on sint channel
            await firstServer.click('#sidebarItem_suscipit-4');
            await firstServer.click('#post_textbox');
            await firstServer.type('#post_textbox', 'Mattermost');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('s');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('c');
            robot.keyTap('c');
            robot.keyTap('enter');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('s');
            robot.keyTap('backspace');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('e');
            robot.keyTap('p');
            robot.keyTap('enter');
            const content = await firstServer.inputValue('#post_textbox');
            content.should.be.equal('Mattermost');
        }
    });

    it('MM-T812 Select All in the Menu Bar', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        await firstServer.waitForSelector('#sidebarItem_suscipit-4');

        // click on sint channel
        await firstServer.click('#sidebarItem_suscipit-4');
        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', 'Mattermost');
        await mainWindow.click('button.three-dot-menu');
        robot.keyTap('e');
        robot.keyTap('s');
        const channelHeaderText = await firstServer.evaluate('window.getSelection().toString()');
        channelHeaderText.should.equal('Mattermost');
    });
});
