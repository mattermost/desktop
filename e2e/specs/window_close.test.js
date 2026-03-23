// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

describe('window.close', function desc() {
    this.timeout(40000);

    const config = env.demoConfig;

    beforeEach(async () => {
        env.cleanDataDir();
        await asyncSleep(1000);
        env.createTestUserDataDir();
        await asyncSleep(1000);
        env.cleanTestConfig();
        await asyncSleep(1000);
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            // eslint-disable-next-line no-empty
            } catch (err) {}
        }
        await env.clearElectronInstances();
        await asyncSleep(1000);
    });

    it('MM-67909 should not crash the app when window.close() is called and the last tab should remain', async () => {
        const serverName = config.servers[0].name;
        const serverView = this.serverMap[serverName][0].win;

        // Call window.close() in the server view's renderer process
        await serverView.evaluate(() => {
            window.close();
        });

        await asyncSleep(1000);

        // The app should still be running and the main window should be accessible
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const isReady = await mainWindow.evaluate(() => document.readyState === 'complete');
        isReady.should.be.true;

        // Rebuild the server map — the server should still have a view
        const serverMap = await env.getServerMap(this.app);
        serverMap.should.have.property(serverName);
        serverMap[serverName].length.should.be.greaterThan(0);
    });

    it('MM-67909 should allow the app to be blurred and refocused after window.close() is called', async () => {
        const serverName = config.servers[0].name;
        const serverView = this.serverMap[serverName][0].win;

        await serverView.evaluate(() => {
            window.close();
        });

        await asyncSleep(500);

        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const browserWindow = await this.app.browserWindow(mainWindow);

        await browserWindow.evaluate((win) => win.blur());
        await asyncSleep(500);

        await browserWindow.evaluate((win) => win.focus());
        await asyncSleep(500);

        const isFocused = await browserWindow.evaluate((win) => win.isFocused());
        isFocused.should.be.true;

        // The server should still have a view after blur/refocus
        const serverMap = await env.getServerMap(this.app);
        serverMap.should.have.property(serverName);
        serverMap[serverName].length.should.be.greaterThan(0);
    });
});
