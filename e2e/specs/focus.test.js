// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const {SHOW_SETTINGS_WINDOW} = require('../../src/common/communication');

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

describe('focus', function desc() {
    this.timeout(40000);

    const config = {
        ...env.demoMattermostConfig,
        teams: [
            ...env.demoMattermostConfig.teams,
            {
                name: 'community',
                url: 'https://community.mattermost.com',
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
        await env.clearElectronInstances();
    });

    describe('Focus textbox tests', () => {
        let firstServer;

        beforeEach(async () => {
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            const textbox = await firstServer.waitForSelector('#post_textbox');
            textbox.focus();
        });

        it('MM-T1315 should return focus to the message box when closing the settings window', async () => {
            this.app.evaluate(({ipcMain}, showWindow) => {
                ipcMain.emit(showWindow);
            }, SHOW_SETTINGS_WINDOW);
            const settingsWindow = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            await settingsWindow.waitForSelector('.settingsPage.container');
            await settingsWindow.close();

            const isTextboxFocused = await firstServer.$eval('#post_textbox', (el) => el === document.activeElement);
            isTextboxFocused.should.be.true;

            // Make sure you can just start typing and it'll go in the post textbox
            await asyncSleep(500);
            robot.typeString('Mattermost');
            await asyncSleep(500);

            const textboxString = await firstServer.inputValue('#post_textbox');
            textboxString.should.equal('Mattermost');
        });

        it('MM-T1316 should return focus to the message box when closing the settings window', async () => {
            const mainView = this.app.windows().find((window) => window.url().includes('index'));
            const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
            await mainView.click('.TeamDropdownButton');
            await dropdownView.click('.TeamDropdown .TeamDropdown__button.addServer');
            const newServerView = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('newServer'),
            });
            await newServerView.waitForSelector('#cancelNewServerModal');
            await newServerView.click('#cancelNewServerModal');

            const isTextboxFocused = await firstServer.$eval('#post_textbox', (el) => el === document.activeElement);
            isTextboxFocused.should.be.true;

            // Make sure you can just start typing and it'll go in the post textbox
            await asyncSleep(500);
            robot.typeString('Mattermost');
            await asyncSleep(500);

            const textboxString = await firstServer.inputValue('#post_textbox');
            textboxString.should.equal('Mattermost');
        });

        it('MM-T1317 should return focus to the focused box when switching servers', async () => {
            const mainView = this.app.windows().find((window) => window.url().includes('index'));
            const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
            await mainView.click('.TeamDropdownButton');
            await dropdownView.click('.TeamDropdown .TeamDropdown__button:has-text("community")');
            // eslint-disable-next-line dot-notation
            const secondServer = this.serverMap['community___TAB_MESSAGING'].win;
            await secondServer.waitForSelector('#input_loginId');
            await secondServer.focus('#input_loginId');

            await mainView.click('.TeamDropdownButton');
            await dropdownView.click(`.TeamDropdown .TeamDropdown__button:has-text("${config.teams[0].name}")`);
            const isTextboxFocused = await firstServer.$eval('#post_textbox', (el) => el === document.activeElement);
            isTextboxFocused.should.be.true;

            // Make sure you can just start typing and it'll go in the post textbox
            await asyncSleep(500);
            robot.typeString('Mattermost');
            await asyncSleep(500);

            const textboxString = await firstServer.inputValue('#post_textbox');
            textboxString.should.equal('Mattermost');

            await mainView.click('.TeamDropdownButton');
            await dropdownView.click('.TeamDropdown .TeamDropdown__button:has-text("community")');
            const isLoginFocused = await secondServer.$eval('#input_loginId', (el) => el === document.activeElement);
            isLoginFocused.should.be.true;

            // Make sure you can just start typing and it'll go in the post textbox
            await asyncSleep(500);
            robot.typeString('username');
            await asyncSleep(500);

            const loginString = await secondServer.inputValue('#input_loginId');
            loginString.should.equal('username');
        });
    });
});
