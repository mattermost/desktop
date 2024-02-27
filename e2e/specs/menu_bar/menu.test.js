// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('menu/menu', function desc() {
    this.timeout(30000);

    const config = env.demoConfig;

    beforeEach(async () => {
        env.cleanDataDir();
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
        await env.clearElectronInstances();
    });

    if (process.platform !== 'darwin') {
        it('MM-T4404 should open the 3 dot menu with Alt', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.not.be.null;

            await mainWindow.bringToFront();
            await mainWindow.click('#app');

            // Settings window should open if Alt works
            robot.keyTap('alt');
            robot.keyTap('enter');
            robot.keyTap('f');
            robot.keyTap('s');
            robot.keyTap('enter');
            const settingsWindow = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            settingsWindow.should.not.be.null;
        });
    }
});
