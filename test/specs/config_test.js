// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../modules/environment');

describe('config', function desc() {
    this.timeout(30000);

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
    });

    it('should show servers in dropdown when there is config file', async () => {
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
                        isOpen: true,
                    },
                    {
                        name: 'TAB_PLAYBOOKS',
                        order: 2,
                        isOpen: true,
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
                        isOpen: true,
                    },
                    {
                        name: 'TAB_PLAYBOOKS',
                        order: 2,
                        isOpen: true,
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
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        this.app = await env.getApp();
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('example');
    });

    it('should upgrade v0 config file', async () => {
        const Config = require('../../src/common/config').default;
        const newConfig = new Config(env.configFilePath);
        const oldConfig = {
            url: env.mattermostURL,
        };
        fs.writeFileSync(env.configFilePath, JSON.stringify(oldConfig));
        this.app = await env.getApp();
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton:has-text("Primary team")');
        dropdownButtonText.should.equal('Primary team');

        const str = fs.readFileSync(env.configFilePath, 'utf8');
        const upgradedConfig = JSON.parse(str);
        upgradedConfig.version.should.equal(newConfig.defaultData.version);
    });
});
