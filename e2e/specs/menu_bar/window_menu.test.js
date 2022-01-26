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
        this.serverMap = await env.getServerMap(this.app);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
    });

    it('MM-T826 should switch to servers when keyboard shortcuts are pressed', async () => {
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
});
