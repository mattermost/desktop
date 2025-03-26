// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('Menu/window_menu', function desc() {
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
        lastActiveTeam: 2,
        minimizeToTray: true,
        alwaysMinimize: true,
    };

    const beforeFunc = async () => {
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

    this.timeout(30000);

    describe('MM-T826 should switch to servers when keyboard shortcuts are pressed', async () => {
        let mainWindow;

        before(async () => {
            await beforeFunc();
            await env.getServerMap(this.app);
            mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        });
        after(afterFunc);

        it('MM-T826_1 should show the second server', async () => {
            let dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton');
            dropdownButtonText.should.equal('google');

            robot.keyTap('2', ['control', process.platform === 'darwin' ? 'command' : 'shift']);
            dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton:has-text("github")');
            dropdownButtonText.should.equal('github');
        });

        it('MM-T826_2 should show the third server', async () => {
            robot.keyTap('3', ['control', process.platform === 'darwin' ? 'command' : 'shift']);
            const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton:has-text("google")');
            dropdownButtonText.should.equal('google');
        });

        it('MM-T826_3 should show the first server', async () => {
            robot.keyTap('1', ['control', process.platform === 'darwin' ? 'command' : 'shift']);
            const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton:has-text("example")');
            dropdownButtonText.should.equal('example');
        });
    });

    describe('MM-T4385 select tab from menu', async () => {
        let mainView;

        before(async () => {
            await beforeFunc();
            mainView = this.app.windows().find((window) => window.url().includes('index'));
        });
        after(afterFunc);

        it('MM-T4385_1 should show the second tab', async () => {
            let tabViewButton = await mainView.innerText('.active');
            tabViewButton.should.equal('Channels');

            robot.keyTap('2', [env.cmdOrCtrl]);
            await asyncSleep(500);
            tabViewButton = await mainView.innerText('.active');
            tabViewButton.should.equal('Boards');
        });

        it('MM-T4385_2 should show the third tab', async () => {
            robot.keyTap('3', [env.cmdOrCtrl]);
            await asyncSleep(500);
            const tabViewButton = await mainView.innerText('.active');
            tabViewButton.should.equal('Playbooks');
        });

        it('MM-T4385_3 should show the first tab', async () => {
            robot.keyTap('1', [env.cmdOrCtrl]);
            await asyncSleep(500);
            const tabViewButton = await mainView.innerText('.active');
            tabViewButton.should.equal('Channels');
        });
    });

    it('MM-T827 select next/previous tab', async () => {
        await beforeFunc();

        const mainView = this.app.windows().find((window) => window.url().includes('index'));

        let tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Channels');

        robot.keyTap('tab', ['control']);
        await asyncSleep(500);
        tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Boards');

        robot.keyTap('tab', ['shift', 'control']);
        await asyncSleep(500);
        tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.equal('Channels');

        await afterFunc();
    });

    if (process.platform !== 'linux') {
        it('MM-T824 should be minimized when keyboard shortcuts are pressed', async () => {
            await beforeFunc();

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const browserWindow = await this.app.browserWindow(mainWindow);
            if (process.platform === 'darwin') {
                robot.keyTap('m', [env.cmdOrCtrl]);
            } else {
                await mainWindow.click('button.three-dot-menu');
                robot.keyTap('w');
                robot.keyTap('m');
                robot.keyTap('enter');
            }

            await asyncSleep(2000);
            const isMinimized = await browserWindow.evaluate((window) => window.isMinimized());
            isMinimized.should.be.true;

            await afterFunc();
        });
    }
    if (process.platform !== 'linux') {
        it('MM-T825 should be hidden when keyboard shortcuts are pressed', async () => {
            await beforeFunc();

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const browserWindow = await this.app.browserWindow(mainWindow);
            robot.keyTap('w', [env.cmdOrCtrl]);
            await asyncSleep(2000);
            const isVisible = await browserWindow.evaluate((window) => window.isVisible());
            isVisible.should.be.false;
            const isDestroyed = await browserWindow.evaluate((window) => window.isDestroyed());
            isDestroyed.should.be.false;

            await afterFunc();
        });
    }
});
