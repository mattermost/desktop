// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');
const path = require('path');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

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

describe('downloads/downloads_menubar', function desc() {
    const beforeFunc = async (dl = {}) => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        fs.writeFileSync(env.downloadsFilePath, JSON.stringify(dl));
        await asyncSleep(1000);
        this.app = await env.getApp();
    };

    const afterFunc = async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    };

    this.timeout(30000);

    it('MM-22239 should not show the downloads dropdown and the menu item should be disabled', async () => {
        await beforeFunc();

        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dlButton = mainWindow.locator('.DownloadsDropdownButton');

        (await dlButton.isVisible()).should.be.false;

        const saveMenuItem = await this.app.evaluate(async ({app}) => {
            const viewMenu = app.applicationMenu.getMenuItemById('view');
            const saveItem = viewMenu.submenu.getMenuItemById('app-menu-downloads');

            return saveItem;
        });

        saveMenuItem.should.haveOwnProperty('enabled', false);

        await afterFunc();
    });

    it('MM-22239 should show the downloads dropdown and the menu item should be enabled', async () => {
        await beforeFunc(downloads);

        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dlButton = mainWindow.locator('.DownloadsDropdownButton');

        (await dlButton.isVisible()).should.be.true;

        const saveMenuItem = await this.app.evaluate(async ({app}) => {
            const viewMenu = app.applicationMenu.getMenuItemById('view');
            const saveItem = viewMenu.submenu.getMenuItemById('app-menu-downloads');

            return saveItem;
        });

        saveMenuItem.should.haveOwnProperty('enabled', true);

        await afterFunc();
    });
});
