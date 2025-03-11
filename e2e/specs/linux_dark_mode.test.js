// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

describe('dark_mode', function desc() {
    this.timeout(30000);

    const config = env.demoConfig;

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    if (process.platform === 'linux') {
        it('MM-T2465 Linux Dark Mode Toggle', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.not.be.null;

            // Toggle Dark Mode
            await toggleDarkMode();

            const topBarElementWithDarkMode = await mainWindow.waitForSelector('.topBar');
            const topBarElementClassWithDarkMode = await topBarElementWithDarkMode.getAttribute('class');

            topBarElementClassWithDarkMode.should.contain('topBar darkMode');

            // Toggle Light Mode
            await toggleDarkMode();

            const topBarElementWithLightMode = await mainWindow.waitForSelector('.topBar');
            const topBarElementClassWithLightMode = await topBarElementWithLightMode.getAttribute('class');

            topBarElementClassWithLightMode.should.contain('topBar');
        });
    }
});

async function toggleDarkMode() {
    robot.keyTap('alt');
    robot.keyTap('enter');
    robot.keyTap('v');
    robot.keyTap('t');
    await asyncSleep(500); // Add a sleep because sometimes the second 't' doesn't fire
    robot.keyTap('t'); // Click on "Toggle Dark Mode" menu item
    robot.keyTap('enter');
}
