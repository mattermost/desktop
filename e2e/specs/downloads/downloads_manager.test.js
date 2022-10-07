// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep, rmDirAsync, writeFileAsync} = require('../../modules/utils');

const config = {
    ...env.demoMattermostConfig,
    teams: [
        ...env.demoMattermostConfig.teams,
        {
            url: 'https://community.mattermost.com',
            name: 'community',
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
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                },
            ],
            lastActiveTab: 0,
        },
    ],
};

describe('downloads/downloads_manager', function desc() {
    this.timeout(30000);
    let firstServer;
    const filename = `${Date.now().toString()}.txt`;

    beforeEach(async () => {
        await env.cleanDataDirAsync();
        await env.cleanTestConfigAsync();
        await env.createTestUserDataDirAsync();
        await writeFileAsync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);

        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);

        const textbox = await firstServer.waitForSelector('#post_textbox');
        const fileInput = await firstServer.waitForSelector('input[type="file"]');
        await fileInput.setInputFiles({
            name: filename,
            mimeType: 'text/plain',
            buffer: Buffer.from('this is test file'),
        });
        await asyncSleep(1000);
        await textbox.focus();
        robot.keyTap('enter');
    });

    afterEach(async () => {
        await rmDirAsync(env.downloadsLocation);
        await this.app?.close?.();
        await env.clearElectronInstances();
    });

    it('MM-22239 should open downloads dropdown when a download starts', async () => {
        await firstServer.locator('#file-attachment-link', {hasText: filename}).click();
        await asyncSleep(1000);
        await Promise.all([
            firstServer.waitForEvent('download'), // It is important to call waitForEvent before click to set up waiting.
            firstServer.locator(`div[role="dialog"] a[download="${filename}"]`).click(), // Triggers the download.
        ]);
        (await env.downloadsDropdownIsOpen(this.app)).should.equal(true);
    });
});
