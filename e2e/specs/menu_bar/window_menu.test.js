// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('Menu/window_menu', function desc() {
    this.timeout(30000);

    const config = {
        ...env.demoConfig,
        teams: [
            ...env.demoConfig.teams,
            {
                name: 'google',
                url: 'https://google.com/',
                order: 2,
                tabs: [
                    {
                        name: 'TAB_MESSAGING',
                        order: 0,
                        isOpen: true,
                    },
                    {
                        name: 'TAB_FOCALBOARD',
                        order: 1,
                        isOpen: true,
                    },
                    {
                        name: 'TAB_PLAYBOOKS',
                        order: 2,
                        isOpen: true,
                    },
                ],
                lastActiveTab: 0,
            },
        ],
    };

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
    });

    it('MM-T826 should switch to servers when keyboard shortcuts are pressed', async () => {
        await env.getServerMap(this.app);
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));

        let dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('example');

        robot.keyTap('2', ['control', 'shift']);
        dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('github');

        robot.keyTap('3', ['control', 'shift']);
        dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('google');

        robot.keyTap('1', ['control', 'shift']);
        dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('example');
    });

    it('MM-T4385 select tab from menu', async () => {
        const mainView = this.app.windows().find((window) => window.url().includes('index'));

        let tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Channels');

        robot.keyTap('2', [process.platform === 'darwin' ? 'command' : 'control']);
        tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Boards');

        robot.keyTap('3', [process.platform === 'darwin' ? 'command' : 'control']);
        tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Playbooks');

        robot.keyTap('1', [process.platform === 'darwin' ? 'command' : 'control']);
        tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Channels');
    });

    it('MM-T827 select next/previous tab', async () => {
        const mainView = this.app.windows().find((window) => window.url().includes('index'));

        let tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Channels');

        robot.keyTap('tab', ['control']);
        tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Boards');

        robot.keyTap('tab', ['shift', 'control']);
        tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Channels');
    });

    it.skip('MM-T824 should be minimized when keyboard shortcuts are pressed', async () => {
        const browserWindow = await this.app.browserWindow(await this.app.firstWindow());
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        await mainWindow.click('button.three-dot-menu');
        robot.keyTap('w');
        robot.keyTap('m');
        robot.keyTap('enter');
        await asyncSleep(2000);
        const isMinimized = await browserWindow.evaluate((window) => window.isMinimized());
        isMinimized.should.be.true;
    });

    it.skip('MM-T825 should be hidden when keyboard shortcuts are pressed', async () => {
        const browserWindow = await this.app.browserWindow(await this.app.firstWindow());
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        await mainWindow.click('button.three-dot-menu');
        robot.keyTap('w');
        robot.keyTap('c');
        robot.keyTap('enter');
        await asyncSleep(2000);
        const isVisible = await browserWindow.evaluate((window) => window.isVisible());
        isVisible.should.be.false;
        const isDestroyed = await browserWindow.evaluate((window) => window.isDestroyed());
        isDestroyed.should.be.false;
    });
});
