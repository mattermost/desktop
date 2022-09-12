// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

const config = env.demoConfig;

describe('downloads/downloads_menubar', function desc() {
    const beforeFunc = async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        fs.writeFileSync(env.downloadsFilePath, JSON.stringify({}));
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
});
