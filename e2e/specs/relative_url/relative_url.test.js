// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const {expect} = require('chai');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('copylink', function desc() {
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

    it('MM-T1308 Check that external links dont open in the app', async () => {
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        await firstServer.waitForSelector('#post_textbox');
        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', 'https://electronjs.org/apps/mattermost');
        await firstServer.press('#post_textbox', 'Enter');
        const newPageWindow = this.app.windows().find((window) => window.url().includes('apps/mattermost'));
        expect(newPageWindow === undefined);
    });
});
