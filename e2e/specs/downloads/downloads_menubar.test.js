// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const path = require('path');

const env = require('../../modules/environment');
const {asyncSleep, writeFileAsync} = require('../../modules/utils');

const config = env.demoConfig;

const downloads = {
    'file1.txt': {
        addedAt: Date.UTC(2022, 8, 8, 10), // Aug 08, 2022 10:00AM UTC
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

describe('downloads/downloads_menubar', function desc() {
    this.timeout(30000);

    describe('The download list is empty', () => {
        beforeEach(async () => {
            await env.createTestUserDataDirAsync();
            await env.cleanTestConfigAsync();
            await writeFileAsync(env.configFilePath, JSON.stringify(config));
            await writeFileAsync(env.downloadsFilePath, JSON.stringify({}));
            await asyncSleep(1000);
            this.app = await env.getApp();
        });

        afterEach(async () => {
            await this.app?.close?.();
            await env.clearElectronInstances();
        });

        it('MM-22239 should not show the downloads dropdown and the menu item should be disabled', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            await mainWindow.waitForLoadState();
            await mainWindow.bringToFront();

            const dlButton = mainWindow.locator('.DownloadsDropdownButton');

            (await dlButton.isVisible()).should.equal(false);

            const saveMenuItem = await this.app.evaluate(async ({app}) => {
                const viewMenu = app.applicationMenu.getMenuItemById('view');
                const saveItem = viewMenu.submenu.getMenuItemById('app-menu-downloads');

                return saveItem;
            });

            saveMenuItem.should.haveOwnProperty('enabled', false);
        });
    });

    describe('The download list has one file', () => {
        beforeEach(async () => {
            await env.createTestUserDataDirAsync();
            await env.cleanTestConfigAsync();
            await writeFileAsync(env.configFilePath, JSON.stringify(config));
            await writeFileAsync(env.downloadsFilePath, JSON.stringify(downloads));
            await asyncSleep(1000);
            this.app = await env.getApp();
        });

        afterEach(async () => {
            await this.app?.close?.();
            await env.clearElectronInstances();
        });

        it('MM-22239 should show the downloads dropdown button and the menu item should be enabled', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            await mainWindow.waitForLoadState();
            await mainWindow.bringToFront();

            const dlButton = await mainWindow.waitForSelector('.DownloadsDropdownButton', {state: 'attached'});
            (await dlButton.isVisible()).should.equal(true);

            const saveMenuItem = await this.app.evaluate(async ({app}) => {
                const viewMenu = app.applicationMenu.getMenuItemById('view');
                const saveItem = viewMenu.submenu.getMenuItemById('app-menu-downloads');

                return saveItem;
            });

            saveMenuItem.should.haveOwnProperty('enabled', true);
        });

        it('MM-22239 should open the downloads dropdown when clicking the download button in the menubar', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            await mainWindow.waitForLoadState();
            await mainWindow.bringToFront();

            const dlButton = await mainWindow.waitForSelector('.DownloadsDropdownButton', {state: 'attached'});
            (await dlButton.isVisible()).should.equal(true);
            await dlButton.click();

            await asyncSleep(500);
            (await env.downloadsDropdownIsOpen(this.app)).should.equal(true);
        });

        it('MM-22239 should open the downloads dropdown from the app menu', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            await mainWindow.waitForLoadState();
            await mainWindow.bringToFront();

            await this.app.evaluate(async ({app}) => {
                const viewMenu = app.applicationMenu.getMenuItemById('view');
                const downloadsItem = viewMenu.submenu.getMenuItemById('app-menu-downloads');

                downloadsItem.click();
            });

            await asyncSleep(500);
            (await env.downloadsDropdownIsOpen(this.app)).should.equal(true);
        });
    });
});
