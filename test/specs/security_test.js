// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

const {SHOW_SETTINGS_WINDOW} = require('../../src/common/communication');

describe.skip('security', function desc() {
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

    beforeEach(async () => {
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

    it('should NOT be able to call Node.js API in webview', async () => {
        const firstView = this.app.windows().find((window) => window.url().includes(env.mattermostURL));
        const isNodeEnabled = await firstView.evaluate(() => {
            try {
                if (require('child_process')) {
                    return true;
                }
                return false;
            } catch (e) {
                return false;
            }
        });
        isNodeEnabled.should.be.false;
    });

    it('should NOT be able to call eval() in any window', async () => {
        const firstView = this.app.windows().find((window) => window.url().includes(env.mattermostURL));
        let isEvalEnabled = await firstView.evaluate(() => {
            try {
                return eval('1 + 1');
            } catch (e) {
                return false;
            }
        });
        isEvalEnabled.should.be.false;

        const mainView = this.app.windows().find((window) => window.url().includes('index'));
        isEvalEnabled = await mainView.evaluate(() => {
            try {
                return eval('1 + 1');
            } catch (e) {
                return false;
            }
        });
        isEvalEnabled.should.be.false;

        this.app.evaluate(({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);
        const settingsWindow = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
        });
        isEvalEnabled = await settingsWindow.evaluate(() => {
            try {
                return eval('1 + 1');
            } catch (e) {
                return false;
            }
        });
        isEvalEnabled.should.be.false;
    });
});
