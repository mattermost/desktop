// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep, rmDirAsync} = require('../../modules/utils');

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
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
        firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        await asyncSleep(2000);

        await firstServer.waitForSelector('#post_textbox');
        const fileInput = await firstServer.waitForSelector('input#fileUploadInput');
        await fileInput.setInputFiles({
            name: filename,
            mimeType: 'text/plain',
            buffer: Buffer.from('this is test file'),
        });
        await asyncSleep(2000);
        await firstServer.click('[aria-label="Send Now"]');
    });

    afterEach(async () => {
        await rmDirAsync(env.downloadsLocation);
        await this.app?.close?.();
        await env.clearElectronInstances();
    });

    it('MM-22239 should open downloads dropdown when a download starts', async () => {
        await firstServer.locator(`a[download="${filename}"]`).click();
        await asyncSleep(1000);
        (await env.downloadsDropdownIsOpen(this.app)).should.equal(true);
    });
});
