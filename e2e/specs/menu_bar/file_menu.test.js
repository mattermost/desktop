// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('file_menu/dropdown', function desc() {
    this.timeout(30000);

    const config = env.demoConfig;

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
    });

    it('MM-T1313 Open Settings modal using keyboard shortcuts', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        mainWindow.should.not.be.null;
        if (process.platform === 'win32' || process.platform === 'linux') {
            robot.keyTap(',', ['control']);
            const settingsWindow = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            settingsWindow.should.not.be.null;
        }
    });

    it('MM-T804 Preferences in Menu Bar open the Settings page', async () => {
        if (process.platform !== 'darwin') {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.not.be.null;
            robot.keyTap(',', ['control']);
            const settingsWindow = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            settingsWindow.should.not.be.null;
            robot.keyTap('w', ['control']);

            //Opening the menu bar
            robot.keyTap('alt');
            robot.keyTap('enter');
            robot.keyTap('f');
            robot.keyTap('s');
            robot.keyTap('enter');
            const settingsWindowFromMenu = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            settingsWindowFromMenu.should.not.be.null;
        }
    });
});
