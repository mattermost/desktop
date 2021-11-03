// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

// const http = require('http');
// const path = require('path');

const robot = require('robotjs');

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

describe('mattermost', function desc() {
    this.timeout(30000);

    const config = {
        version: 3,
        teams: [{
            name: 'example',
            url: env.mattermostURL,
            order: 0,
            tabs: [
                {
                    name: 'TAB_MESSAGING',
                    order: 0,
                    isOpen: true,
                },
                {
                    name: 'TAB_FOCALBOARD',
                    order: 1,
                    isOpen: false,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: false,
                },
            ],
            lastActiveTab: 0,
        }, {
            name: 'github',
            url: 'https://github.com/',
            order: 1,
            tabs: [
                {
                    name: 'TAB_MESSAGING',
                    order: 0,
                    isOpen: true,
                },
                {
                    name: 'TAB_FOCALBOARD',
                    order: 1,
                    isOpen: false,
                },
                {
                    name: 'TAB_PLAYBOOKS',
                    order: 2,
                    isOpen: false,
                },
            ],
            lastActiveTab: 0,
        }],
        showTrayIcon: false,
        trayIconTheme: 'light',
        minimizeToTray: false,
        notifications: {
            flashWindow: 0,
            bounceIcon: false,
            bounceIconType: 'informational',
        },
        showUnreadBadge: true,
        useSpellChecker: true,
        enableHardwareAcceleration: true,
        autostart: true,
        darkMode: false,
        lastActiveTeam: 0,
        spellCheckerLocales: [],
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

    it('should reload page when pressing Ctrl+R', async () => {
        const mainWindow = await this.app.firstWindow();
        const browserWindow = await this.app.browserWindow(mainWindow);
        const webContentsId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;

        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const check = browserWindow.evaluate(async (window, id) => {
            const promise = new Promise((resolve) => {
                const browserView = window.getBrowserViews().find((view) => view.webContents.id === id);
                browserView.webContents.on('did-finish-load', () => {
                    resolve();
                });
            });
            await promise;
            return true;
        }, webContentsId);
        await asyncSleep(500);
        robot.keyTap('r', ['control']);
        const result = await check;
        result.should.be.true;
    });

    it('should reload page when pressing Ctrl+Shift+R', async () => {
        const mainWindow = await this.app.firstWindow();
        const browserWindow = await this.app.browserWindow(mainWindow);
        const webContentsId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;

        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const check = browserWindow.evaluate(async (window, id) => {
            const promise = new Promise((resolve) => {
                const browserView = window.getBrowserViews().find((view) => view.webContents.id === id);
                browserView.webContents.on('did-finish-load', () => {
                    resolve();
                });
            });
            await promise;
            return true;
        }, webContentsId);
        await asyncSleep(500);
        robot.keyTap('r', ['control', 'shift']);
        const result = await check;
        result.should.be.true;
    });

    it('should switch to servers when keyboard shortcuts are pressed', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));

        let dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('example');

        robot.keyTap('2', ['control', 'shift']);
        dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('github');

        robot.keyTap('1', ['control', 'shift']);
        dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('example');
    });

    if (process.platform !== 'darwin') {
        it('should open the 3 dot menu with Alt', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.not.be.null;

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
