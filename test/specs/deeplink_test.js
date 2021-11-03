// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';
const fs = require('fs');

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

describe('application', function desc() {
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
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            // eslint-disable-next-line no-empty
            } catch (err) {}
        }
    });

    if (process.platform === 'win32') {
        it('should open the app on the requested deep link', async () => {
            this.app = await env.getApp(['mattermost://github.com/test/url']);
            this.serverMap = await env.getServerMap(this.app);
            const mainWindow = await this.app.firstWindow();
            const browserWindow = await this.app.browserWindow(mainWindow);
            const webContentsId = this.serverMap[`${config.teams[1].name}___TAB_MESSAGING`].webContentsId;
            const isActive = await browserWindow.evaluate((window, id) => {
                return window.getBrowserViews().find((view) => view.webContents.id === id).webContents.getURL();
            }, webContentsId);
            isActive.should.equal('https://github.com/test/url');
            const mainView = this.app.windows().find((window) => window.url().includes('index'));
            const dropdownButtonText = await mainView.innerText('.TeamDropdownButton');
            dropdownButtonText.should.equal('github');
            await this.app.close();
        });
    }
});
