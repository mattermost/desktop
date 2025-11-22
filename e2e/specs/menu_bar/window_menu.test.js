// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('Menu/window_menu', function desc() {
    const config = {
        ...env.demoMattermostConfig,
        servers: [
            ...env.demoMattermostConfig.servers,
            {
                name: 'google',
                url: 'https://google.com/',
                order: 2,
            },
        ],
        lastActiveServer: 0,
        minimizeToTray: true,
        alwaysMinimize: true,
    };

    const beforeFunc = async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
        const mmServer = this.serverMap[config.servers[0].name][0].win;
        await env.loginToMattermost(mmServer);
    };

    const afterFunc = async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    };

    this.timeout(60000);

    describe('MM-T826 should switch to servers when keyboard shortcuts are pressed', async () => {
        let mainWindow;

        before(async () => {
            await beforeFunc();
            mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        });
        after(afterFunc);

        it('MM-T826_1 should show the second server', async () => {
            let dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton');
            dropdownButtonText.should.contain('example');

            robot.keyTap('2', ['control', process.platform === 'darwin' ? 'command' : 'shift']);
            dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton:has-text("github")');
            dropdownButtonText.should.contain('github');
        });

        it('MM-T826_2 should show the third server', async () => {
            robot.keyTap('3', ['control', process.platform === 'darwin' ? 'command' : 'shift']);
            const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton:has-text("google")');
            dropdownButtonText.should.contain('google');
        });

        it('MM-T826_3 should show the first server', async () => {
            robot.keyTap('1', ['control', process.platform === 'darwin' ? 'command' : 'shift']);
            const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton:has-text("example")');
            dropdownButtonText.should.contain('example');
        });
    });

    describe('MM-T4385 select tab from menu', async () => {
        let mainView;

        before(async () => {
            await beforeFunc();
            mainView = this.app.windows().find((window) => window.url().includes('index'));
            await mainView.click('#newTabButton');
            await mainView.click('#newTabButton');

            // macOS 15 needs more time for tabs to initialize
            await asyncSleep(process.platform === 'darwin' ? 5000 : 3000);
            this.serverMap = await env.getServerMap(this.app);

            const secondTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 10000});
            await secondTab.click();
            await asyncSleep(1000);
            const secondView = this.serverMap[config.servers[0].name][1].win;
            await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 10000});
            await secondView.click('#sidebarItem_off-topic');
            await asyncSleep(500);

            const thirdTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 10000});
            await thirdTab.click();
            await asyncSleep(1000);
            const thirdView = this.serverMap[config.servers[0].name][2].win;
            await thirdView.waitForSelector('#sidebarItem_town-square', {timeout: 10000});
            await thirdView.click('#sidebarItem_town-square');
            await asyncSleep(500);
        });
        after(afterFunc);

        it('MM-T4385_1 should show the second tab', async () => {
            let tabViewButton = await mainView.innerText('.active');
            tabViewButton.should.contain('Town Square');

            robot.keyTap('2', [env.cmdOrCtrl]);
            await asyncSleep(500);
            tabViewButton = await mainView.innerText('.active');
            tabViewButton.should.contain('Off-Topic');
        });

        it('MM-T4385_2 should show the third tab', async () => {
            robot.keyTap('3', [env.cmdOrCtrl]);
            await asyncSleep(500);
            const tabViewButton = await mainView.innerText('.active');
            tabViewButton.should.contain('Town Square');
        });

        it('MM-T4385_3 should show the first tab', async () => {
            robot.keyTap('1', [env.cmdOrCtrl]);
            await asyncSleep(500);
            const tabViewButton = await mainView.innerText('.active');
            tabViewButton.should.contain('Town Square');
        });
    });

    it('MM-T827 select next/previous tab', async () => {
        await beforeFunc();

        const mainView = this.app.windows().find((window) => window.url().includes('index'));

        await mainView.click('#newTabButton');
        await asyncSleep(3000);
        this.serverMap = await env.getServerMap(this.app);

        const secondTab = await mainView.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
        await secondTab.click();
        const secondView = this.serverMap[config.servers[0].name][1].win;
        await secondView.waitForSelector('#sidebarItem_off-topic');
        await secondView.click('#sidebarItem_off-topic');

        let tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.contain('Off-Topic');

        robot.keyTap('tab', ['control']);
        await asyncSleep(500);
        tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.contain('Town Square');

        robot.keyTap('tab', ['shift', 'control']);
        await asyncSleep(500);
        tabViewButton = await mainView.innerText('.active');
        tabViewButton.should.contain('Off-Topic');

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

            // send Shift + Command + W on mac
            const modifiers = process.platform === 'darwin' ?
                ['shift', 'command'] :
                [env.cmdOrCtrl];

            robot.keyTap('w', modifiers);
            await asyncSleep(2000);
            const isVisible = await browserWindow.evaluate((window) => window.isVisible());
            isVisible.should.be.false;
            const isDestroyed = await browserWindow.evaluate((window) => window.isDestroyed());
            isDestroyed.should.be.false;

            await afterFunc();
        });
    }
});
