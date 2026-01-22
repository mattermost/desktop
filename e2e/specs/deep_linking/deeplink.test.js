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

            // Wait for server map to have the github server populated
            const serverName = config.servers[1].name;
            if (!this.serverMap[serverName] || this.serverMap[serverName].length === 0) {
                // Retry getting server map if github server is not ready
                await asyncSleep(2000);
                this.serverMap = await env.getServerMap(this.app);
            }

            // Ensure we have the server data before accessing webContentsId
            this.serverMap.should.have.property(serverName);
            this.serverMap[serverName].should.have.lengthOf.at.least(1);

            const webContentsId = this.serverMap[serverName][0].webContentsId;
            const isActive = await browserWindow.evaluate((window, id) => {
                const view = window.contentView.children.find((view) => view.webContents && view.webContents.id === id);
                return view ? view.webContents.getURL() : null;
            }, webContentsId);
            isActive.should.equal('https://github.com/test/url/');
            const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton');
            dropdownButtonText.should.equal('github');
            await this.app.close();
        });
    }
});
