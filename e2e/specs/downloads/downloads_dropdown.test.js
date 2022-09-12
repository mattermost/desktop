// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const path = require('path');

const env = require('../../modules/environment');
const {asyncSleep, mkDirAsync, rmDirAsync, writeFileAsync} = require('../../modules/utils');

const config = env.demoConfig;

const downloads = {
    'file1.txt': {
        addedAt: 1662986690345,
        filename: 'file1.txt',
        mimeType: 'plain/text',
        location: path.join(env.downloadsLocation, 'file1.txt'),
        progress: 100,
        receivedBytes: 3917388,
        state: 'completed',
        totalBytes: 3917388,
        type: 'file',
    },
};

describe('downloads/downloads_dropdown', function desc() {
    this.timeout(60000);

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        await writeFileAsync(env.configFilePath, JSON.stringify(config));
        await writeFileAsync(env.downloadsFilePath, JSON.stringify(downloads));
        await mkDirAsync(env.downloadsLocation);
        await writeFileAsync(path.join(env.downloadsLocation, 'file1.txt'), 'file1 content');
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
    });

    afterEach(async () => {
        await rmDirAsync(env.downloadsLocation);
        await this.app?.close?.();
        await env.clearElectronInstances();
    });

    it('MM-22239 should display the file correctly', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));

        const dlButtonLocator = await mainWindow.waitForSelector('.DownloadsDropdownButton');
        await dlButtonLocator.click();

        const downloadsWindow = this.app.windows().find((window) => window.url().includes('downloadsDropdown'));

        const filenameTextLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__Filename');
        const filenameInnerText = await filenameTextLocator.innerText();
        filenameInnerText.should.equal(downloads['file1.txt'].filename);

        const fileStateLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__FileSizeAndStatus');
        const fileStateInnerText = await fileStateLocator.innerText();
        fileStateInnerText.should.equal('3.92 MB • Downloaded');

        const fileThumbnailLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Thumbnail');
        const thumbnailBackgroundImage = await fileThumbnailLocator.evaluate((node) => window.getComputedStyle(node).getPropertyValue('background-image'));
        thumbnailBackgroundImage.should.include('text..svg');
    });
});
