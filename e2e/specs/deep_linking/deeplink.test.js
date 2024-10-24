// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';
const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('application', function desc() {
    this.timeout(30000);

    const config = env.demoConfig;

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            // eslint-disable-next-line no-empty
            } catch (err) {}
        }
        await env.clearElectronInstances();
    });

    if (process.platform === 'win32') {
        it('MM-T1304/MM-T1306 should open the app on the requested deep link', async () => {
            this.app = await env.getApp(['mattermost://github.com/test/url']);
            this.serverMap = await env.getServerMap(this.app);
            if (!this.app.windows().some((window) => window.url().includes('github.com'))) {
                await this.app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('github.com'),
                });
            }
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const browserWindow = await this.app.browserWindow(mainWindow);
            const webContentsId = this.serverMap[`${config.teams[1].name}___TAB_MESSAGING`].webContentsId;
            const isActive = await browserWindow.evaluate((window, id) => {
                return window.contentView.children.find((view) => view.webContents.id === id).webContents.getURL();
            }, webContentsId);
            isActive.should.equal('https://github.com/test/url/');
            const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton');
            dropdownButtonText.should.equal('github');
            await this.app.close();
        });
    }
});
