// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const path = require('path');

const env = require('../../modules/environment');
const {asyncSleep, mkDirAsync, rmDirAsync, writeFileAsync} = require('../../modules/utils');

const config = env.demoConfig;

const file1 = {
    addedAt: Date.UTC(2022, 8, 8, 10), // Aug 08, 2022 10:00AM UTC
    filename: 'file1.txt',
    mimeType: 'plain/text',
    location: path.join(env.downloadsLocation, 'file1.txt'),
    progress: 100,
    receivedBytes: 3917388,
    state: 'completed',
    totalBytes: 3917388,
    type: 'file',
};

describe('downloads/downloads_dropdown', function desc() {
    this.timeout(30000);

    describe('The list has one downloaded file', () => {
        const downloads = {
            [file1.filename]: file1,
        };

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

        it('MM-22239 should display the file correctly (downloaded)', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            await mainWindow.waitForLoadState();
            await mainWindow.bringToFront();

            const dlButtonLocator = await mainWindow.waitForSelector('.DownloadsDropdownButton');
            await dlButtonLocator.click();

            await asyncSleep(500);
            const downloadsWindow = this.app.windows().find((window) => window.url().includes('downloadsDropdown'));
            await downloadsWindow.waitForLoadState();
            await downloadsWindow.bringToFront();

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

    describe('The list has one downloaded file but it is deleted from the folder', () => {
        const downloads = {
            [file1.filename]: file1,
        };

        beforeEach(async () => {
            env.createTestUserDataDir();
            env.cleanTestConfig();
            await writeFileAsync(env.configFilePath, JSON.stringify(config));
            await writeFileAsync(env.downloadsFilePath, JSON.stringify(downloads));
            await mkDirAsync(env.downloadsLocation);
            await asyncSleep(1000);
            this.app = await env.getApp();
            this.serverMap = await env.getServerMap(this.app);
        });

        afterEach(async () => {
            await rmDirAsync(env.downloadsLocation);
            await this.app?.close?.();
            await env.clearElectronInstances();
        });

        it('MM-22239 should display the file correctly (deleted)', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            await mainWindow.waitForLoadState();
            await mainWindow.bringToFront();

            const dlButtonLocator = await mainWindow.waitForSelector('.DownloadsDropdownButton');
            await dlButtonLocator.click();
            await asyncSleep(500);

            const downloadsWindow = this.app.windows().find((window) => window.url().includes('downloadsDropdown'));
            await downloadsWindow.waitForLoadState();
            await downloadsWindow.bringToFront();

            const filenameTextLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__Filename');
            const filenameInnerText = await filenameTextLocator.innerText();
            filenameInnerText.should.equal(downloads['file1.txt'].filename);

            const fileStateLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__FileSizeAndStatus');
            const fileStateInnerText = await fileStateLocator.innerText();
            fileStateInnerText.should.equal('3.92 MB • Deleted');

            const fileThumbnailLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Thumbnail');
            const thumbnailBackgroundImage = await fileThumbnailLocator.evaluate((node) => window.getComputedStyle(node).getPropertyValue('background-image'));
            thumbnailBackgroundImage.should.include('text..svg');
        });
    });

    describe('The list has one cancelled file', () => {
        const downloads = {
            [file1.filename]: {
                ...file1,
                state: 'progressing',
                progress: 50,
                receivedBytes: 1958694,
                totalBytes: 3917388,
            },
        };

        beforeEach(async () => {
            await env.createTestUserDataDirAsync();
            await env.cleanTestConfigAsync();
            await writeFileAsync(env.configFilePath, JSON.stringify(config));
            await writeFileAsync(env.downloadsFilePath, JSON.stringify(downloads));
            await mkDirAsync(env.downloadsLocation);
            await writeFileAsync(path.join(env.downloadsLocation, 'file1.txt'), 'file1 content');
            await asyncSleep(1000);
            this.app = await env.getApp();
        });

        afterEach(async () => {
            await rmDirAsync(env.downloadsLocation);
            await this.app?.close?.();
            await env.clearElectronInstances();
        });

        it('MM-22239 should display the file correctly (cancelled)', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            await mainWindow.waitForLoadState();
            await mainWindow.bringToFront();

            const dlButtonLocator = await mainWindow.waitForSelector('.DownloadsDropdownButton');
            await dlButtonLocator.click();
            await asyncSleep(500);

            const downloadsWindow = this.app.windows().find((window) => window.url().includes('downloadsDropdown'));
            downloadsWindow.evaluate(() => {
                Date.now = () => {
                    return Date.UTC(2022, 8, 8, 10, 0, 10); // 10seconds after the "addedAt" date
                };
            });
            await downloadsWindow.waitForLoadState();
            await downloadsWindow.bringToFront();

            const filenameTextLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__Filename');
            const filenameInnerText = await filenameTextLocator.innerText();
            filenameInnerText.should.equal(downloads['file1.txt'].filename);

            const fileStateLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__FileSizeAndStatus');
            const fileStateInnerText = await fileStateLocator.innerText();
            fileStateInnerText.should.equal('3.92 MB • Cancelled');

            const fileThumbnailLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Thumbnail');
            const thumbnailBackgroundImage = await fileThumbnailLocator.evaluate((node) => window.getComputedStyle(node).getPropertyValue('background-image'));
            thumbnailBackgroundImage.should.include('text..svg');
        });
    });
});
