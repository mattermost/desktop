// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('server_management/tab_management', function desc() {
    this.timeout(30000);
    const config = env.demoMattermostConfig;

    const beforeFunc = async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
    };

    const afterFunc = async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    };

    describe('MM-TXXXX should be able to close server tabs', async () => {
        let mainWindow;

        before(async () => {
            await beforeFunc();
            this.serverMap = await env.getServerMap(this.app);
            const mmServer = this.serverMap[config.servers[0].name][0].win;
            await env.loginToMattermost(mmServer);
            mainWindow = this.app.windows().find((window) => window.url().includes('index'));

            // Create a new tab by clicking the new tab button
            await mainWindow.click('#newTabButton');
            await asyncSleep(2000);

            // Wait for the new tab to be visible
            await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            await asyncSleep(1000);

            // Refresh serverMap to get the new tab
            this.serverMap = await env.getServerMap(this.app);

            // Ensure we have the new tab in the server map
            const serverName = config.servers[0].name;
            if (!this.serverMap[serverName] || this.serverMap[serverName].length < 2) {
                // Retry getting server map if tab is not ready
                await asyncSleep(2000);
                this.serverMap = await env.getServerMap(this.app);
            }

            // Navigate to a different channel in the new tab
            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            await secondTab.click();
            await asyncSleep(1000);

            const secondView = this.serverMap[serverName][1].win;
            await secondView.waitForSelector('#sidebarItem_off-topic');
            await secondView.click('#sidebarItem_off-topic');
            await asyncSleep(1000);
        });

        after(afterFunc);

        it('MM-TXXXX_1 should close a server tab when clicking the x button', async () => {
            // Verify we have 2 tabs initially
            const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            firstTab.should.exist;
            secondTab.should.exist;

            // Click the close button on the second tab
            const secondTabCloseButton = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2) .serverTabItem__close');
            await secondTabCloseButton.click();
            await asyncSleep(1000);

            // Verify the tab was closed - should only have 1 tab now
            const remainingTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const thirdTab = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
            remainingTab.should.exist;
            (thirdTab === null).should.be.true;
        });
    });

    describe('MM-TXXXX main tab for a server cannot be closed', async () => {
        let mainWindow;

        before(async () => {
            await beforeFunc();
            this.serverMap = await env.getServerMap(this.app);
            const mmServer = this.serverMap[config.servers[0].name][0].win;
            await env.loginToMattermost(mmServer);
            mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        });

        after(afterFunc);

        it('MM-TXXXX_2 should not show close button on the main tab when there is only one tab', async () => {
            // Verify we have only 1 tab initially (the main tab)
            const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const secondTab = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
            firstTab.should.exist;
            (secondTab === null).should.be.true;

            // Verify the close button is not present on the main tab
            const closeButton = await mainWindow.$('.TabBar li.serverTabItem .serverTabItem__close');
            (closeButton === null).should.be.true;
        });

        it('MM-TXXXX_3 should show close button on the main tab when there are multiple tabs', async () => {
            // Create a new tab
            await mainWindow.click('#newTabButton');
            await asyncSleep(2000);

            // Verify we have 2 tabs now
            const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            const thirdTab = await mainWindow.$('.TabBar li.serverTabItem:nth-child(3)');
            firstTab.should.exist;
            secondTab.should.exist;
            (thirdTab === null).should.be.true;

            // Verify the close button is present on both tabs
            const firstTabCloseButton = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1) .serverTabItem__close');
            const secondTabCloseButton = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2) .serverTabItem__close');
            firstTabCloseButton.should.exist;
            secondTabCloseButton.should.exist;

            // Click the close button on the second tab
            await secondTabCloseButton.click();
            await asyncSleep(1000);

            // Verify the tab was closed - should only have 1 tab now
            const remainingTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const secondTabAfterClose = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
            remainingTab.should.exist;
            (secondTabAfterClose === null).should.be.true;
        });
    });
});
