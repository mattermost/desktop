// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep, rmDirAsync} = require('../../modules/utils');

const config = {
    ...env.demoMattermostConfig,
    servers: [
        ...env.demoMattermostConfig.servers,
        {
            url: 'https://community.mattermost.com',
            name: 'community',
            order: 0,
        },
    ],
};

describe('downloads/downloads_manager', function desc() {
    // macOS and Windows need 120s, Linux needs 90s due to slower CI with file operations
    const timeout = (() => {
        if (process.platform === 'win32' || process.platform === 'darwin') {
            return 120000;
        }
        return 90000;
    })();
    this.timeout(timeout);
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
        firstServer = this.serverMap[config.servers[0].name][0].win;
        await env.loginToMattermost(firstServer);
        await asyncSleep(2000);

        await firstServer.waitForSelector('#post_textbox', {timeout: 15000});
        const fileInput = await firstServer.waitForSelector('input#fileUploadInput', {timeout: 10000});
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
