// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('MM-T2633 Back button should behave as expected', function desc() {
    this.timeout(30000);

    const config = {
        ...env.demoConfig,
        teams: [
            {
                name: 'community',
                url: 'https://community.mattermost.com',
                order: 0,
                tabs: [
                    {
                        name: 'TAB_MESSAGING',
                        order: 0,
                        isOpen: true,
                    },
                    {
                        name: 'TAB_FOCALBOARD',
                        order: 1,
                        isOpen: true,
                    },
                    {
                        name: 'TAB_PLAYBOOKS',
                        order: 2,
                        isOpen: true,
                    },
                ],
                lastActiveTab: 0,
            },
        ],
    };

    let mainWindow;
    let firstServer;
    let backButton;

    before(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);

        mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await firstServer.click('a:has-text("OneLogin")');
        backButton = await mainWindow.waitForSelector('button:has-text("Back")');
    });

    after(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    it('MM-T2633_1 after clicking OneLogin, back button should appear', async () => {
        backButton.should.not.be.null;
        const poweredByOneLogin = await firstServer.waitForSelector('a:has-text("Powered by OneLogin")');
        poweredByOneLogin.should.not.be.null;
    });

    it('MM-T2633_2 after clicking Back, should be back on the login screen', async () => {
        await backButton.click();
        const loginPrompt = await firstServer.waitForSelector('#input_loginId');
        loginPrompt.should.not.be.null;
        await mainWindow.waitForSelector('button:has-text("Back")', {state: 'hidden'});
    });

    it('MM-T2633_3 on the OneLogin screen, should still allow links to be clicked and still show the Back button', async () => {
        let isNewWindow = false;
        this.app.on('window', () => {
            isNewWindow = true;
        });
        const oneLoginUrl = firstServer.url();
        await firstServer.click('a:has-text("OneLogin")');
        const poweredByOneLogin = await firstServer.waitForSelector('a:has-text("Powered by OneLogin")');
        poweredByOneLogin.click();
        backButton = await mainWindow.waitForSelector('button:has-text("Back")');
        backButton.should.not.be.null;
        const frameUrl = firstServer.url();
        frameUrl.should.not.equal(oneLoginUrl);
        isNewWindow.should.be.false;
        await firstServer.waitForSelector('a:has-text("Powered by OneLogin")', {state: 'hidden'});
    });

    it('MM-T2633_4 after click Back twice, user should be on the main login screen again', async () => {
        await backButton.click();
        await firstServer.waitForURL('https://mattermost.onelogin.com/**');
        await backButton.click();
        const loginPrompt = await firstServer.waitForSelector('#input_loginId');
        loginPrompt.should.not.be.null;
    });
});
