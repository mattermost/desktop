// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('back_button', function desc() {
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

    it('MM-T2633 Back button should behave as expected', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;

        await firstServer.click('a:has-text("OneLogin")');
        let backButton = await mainWindow.waitForSelector('button:has-text("Back")');
        backButton.should.not.be.null;
        let poweredByOneLogin = await firstServer.waitForSelector('a:has-text("Powered by OneLogin")');
        poweredByOneLogin.should.not.be.null;

        await backButton.click();
        let loginPrompt = await firstServer.waitForSelector('#input_loginId');
        loginPrompt.should.not.be.null;
        await mainWindow.waitForSelector('button:has-text("Back")', {state: 'hidden'});

        let isNewWindow = false;
        this.app.on('window', () => {
            isNewWindow = true;
        });
        const oneLoginUrl = firstServer.url();
        await firstServer.click('a:has-text("OneLogin")');
        poweredByOneLogin = await firstServer.waitForSelector('a:has-text("Powered by OneLogin")');
        poweredByOneLogin.click();
        backButton = await mainWindow.waitForSelector('button:has-text("Back")');
        backButton.should.not.be.null;
        const frameUrl = firstServer.url();
        frameUrl.should.not.equal(oneLoginUrl);
        isNewWindow.should.be.false;

        await backButton.click();
        await backButton.click();
        loginPrompt = await firstServer.waitForSelector('#input_loginId');
        loginPrompt.should.not.be.null;
    });
});
