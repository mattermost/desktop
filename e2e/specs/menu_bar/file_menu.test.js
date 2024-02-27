// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('file_menu/dropdown', function desc() {
    this.timeout(30000);

    const config = env.demoConfig;

    let skipAfterEach = false;

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();

        skipAfterEach = false;
    });

    afterEach(async () => {
        if (this.app && skipAfterEach === false) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    it('MM-T1313 Open Settings modal using keyboard shortcuts', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        mainWindow.should.not.be.null;
        robot.keyTap(',', [env.cmdOrCtrl]);
        const settingsWindow = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
        });
        settingsWindow.should.not.be.null;
    });

    // TODO: No keyboard shortcut for macOS
    if (process.platform !== 'darwin') {
        it('MM-T805 Sign in to Another Server Window opens using menu item', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.not.be.null;
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('f');
            robot.keyTap('s');
            robot.keyTap('s');
            robot.keyTap('enter');
            const signInToAnotherServerWindow = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('newServer'),
            });
            signInToAnotherServerWindow.should.not.be.null;
        });
    }

    if (process.platform !== 'darwin') {
        it('MM-T804 Preferences in Menu Bar open the Settings page', async () => {
            //Opening the menu bar
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.not.be.null;
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('f');
            robot.keyTap('s');
            robot.keyTap('enter');
            const settingsWindowFromMenu = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            settingsWindowFromMenu.should.not.be.null;
        });
    }

    // TODO: Causes issues on Windows so skipping for Windows
    if (process.platform !== 'win32') {
        it('MM-T806 Exit in the Menu Bar', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.not.be.null;

            if (process.platform === 'darwin') {
                robot.keyTap('q', ['command']);
            }

            if (process.platform === 'linux' || process.platform === 'win32') {
                robot.keyTap('q', ['control']);
            }

            await asyncSleep(500);
            this.app.windows().find((window) => window.url().should.not.include('index'));

            skipAfterEach = true; // Need to skip closing in aftereach as apps execution context is destroyed above
        });
    }
});
