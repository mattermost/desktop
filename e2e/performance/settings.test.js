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

    describe('Open settings window', () => {
        it('Should happen within expected duration', async () => {
            const expected = (process.platform === 'win32' || process.platform === 'linux');
            this.app.evaluate(({ipcMain}, showWindow) => {
                ipcMain.emit(showWindow);
            }, SHOW_SETTINGS_WINDOW);

            const t0 = performance.now();

            const settingsWindow = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            await settingsWindow.waitForSelector('.settingsPage.container');
            await settingsWindow.waitForSelector('#inputAutoStart', {state: expected ? 'attached' : 'detached'});

            const t1 = performance.now();
            const duration = t1 - t0;

            duration.should.lessThanOrEqual(500);
        });

        it('Should happen within expected duration failing example', async () => {
            const expected = (process.platform === 'win32' || process.platform === 'linux');
            this.app.evaluate(({ipcMain}, showWindow) => {
                ipcMain.emit(showWindow);
            }, SHOW_SETTINGS_WINDOW);

            const t0 = performance.now();

            const settingsWindow = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            await settingsWindow.waitForSelector('.settingsPage.container');
            await settingsWindow.waitForSelector('#inputAutoStart', {state: expected ? 'attached' : 'detached'});

            const t1 = performance.now();
            const duration = t1 - t0;

            duration.should.lessThanOrEqual(10);
        });
    });
});
