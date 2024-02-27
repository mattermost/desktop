// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const robot = require('robotjs');

const {SHOW_SETTINGS_WINDOW} = require('../../../src/common/communication');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('settings/keyboard_shortcuts', function desc() {
    this.timeout(30000);
    const config = env.demoConfig;

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
        await env.clearElectronInstances();
    });

    describe('MM-T1288 Manipulating Text', () => {
        let settingsWindow;

        beforeEach(async () => {
            this.app.evaluate(({ipcMain}, showWindow) => {
                ipcMain.emit(showWindow);
            }, SHOW_SETTINGS_WINDOW);
            settingsWindow = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            await settingsWindow.waitForSelector('.settingsPage.container');

            const textbox = await settingsWindow.waitForSelector('#inputSpellCheckerLocalesDropdown');
            await textbox.scrollIntoViewIfNeeded();
            await textbox.type('mattermost');
        });

        it('MM-T1288_1 should be able to select all in the settings window', async () => {
            await settingsWindow.click('#inputSpellCheckerLocalesDropdown');
            robot.keyTap('a', [process.platform === 'darwin' ? 'command' : 'control']);
            const selectedText = await settingsWindow.evaluate(() => {
                const box = document.querySelectorAll('#inputSpellCheckerLocalesDropdown')[0];
                return box.value.substring(box.selectionStart,
                    box.selectionEnd);
            });
            selectedText.should.equal('mattermost');
        });

        it('MM-T1288_2 should be able to cut and paste in the settings window', async () => {
            const textbox = await settingsWindow.waitForSelector('#inputSpellCheckerLocalesDropdown');

            await textbox.selectText({force: true});
            robot.keyTap('x', [process.platform === 'darwin' ? 'command' : 'control']);
            let textValue = await textbox.getAttribute('value');
            textValue.should.equal('');

            await textbox.focus();
            robot.keyTap('v', [process.platform === 'darwin' ? 'command' : 'control']);
            textValue = await textbox.getAttribute('value');
            textValue.should.equal('mattermost');
        });

        it('MM-T1288_3 should be able to copy and paste in the settings window', async () => {
            const textbox = await settingsWindow.waitForSelector('#inputSpellCheckerLocalesDropdown');

            await textbox.selectText({force: true});
            robot.keyTap('c', [process.platform === 'darwin' ? 'command' : 'control']);
            await textbox.focus();
            await textbox.type('other-text');
            robot.keyTap('v', [process.platform === 'darwin' ? 'command' : 'control']);
            const textValue = await textbox.getAttribute('value');
            textValue.should.equal('other-textmattermost');
        });
    });
});
