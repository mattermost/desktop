// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const {SHOW_SETTINGS_WINDOW} = require('../../src/common/communication');

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

describe('Settings', function desc() {
    this.timeout(30000);

    const config = env.demoConfig;

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        fs.writeFileSync(env.appUpdatePath, '');
        await asyncSleep(1000);
        this.app = await env.getApp();
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    describe('Options', () => {
        describe('Start app on login', () => {
            it('MM-T4392 should appear on win32 or linux', async () => {
                const expected = (process.platform === 'win32' || process.platform === 'linux');
                this.app.evaluate(({ipcMain}, showWindow) => {
                    ipcMain.emit(showWindow);
                }, SHOW_SETTINGS_WINDOW);
                const settingsWindow = await this.app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                });
                await settingsWindow.waitForSelector('.settingsPage.container');
                await settingsWindow.waitForSelector('#inputAutoStart', {state: expected ? 'attached' : 'detached'});
                const existing = await settingsWindow.isVisible('#inputAutoStart');
                existing.should.equal(expected);
            });
        });
    });
});
