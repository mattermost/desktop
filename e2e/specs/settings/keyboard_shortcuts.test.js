// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const robot = require('robotjs');
const {SHOW_SETTINGS_WINDOW} = require('src/common/communication');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('settings/keyboard_shortcuts', function desc() {
    this.timeout(30000);
    const config = env.demoConfig;
    let settingsWindow;

    before(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();

        this.app.evaluate(({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);
        settingsWindow = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
        });
        await settingsWindow.waitForSelector('#settingCategoryButton-language');
        await settingsWindow.click('#settingCategoryButton-language');

        const textbox = await settingsWindow.waitForSelector('#selectSetting_spellCheckerLocales');
        await textbox.scrollIntoViewIfNeeded();
    });

    after(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    describe('MM-T1288 Manipulating Text', () => {
        it('MM-T1288_1 should be able to select and deselect language in the settings window', async () => {
            let textboxString;
            await settingsWindow.click('#selectSetting_spellCheckerLocales');
            await settingsWindow.type('#selectSetting_spellCheckerLocales', 'Afrikaans');
            robot.keyTap('tab');

            await settingsWindow.isVisible('.SettingsModal__saving');

            textboxString = await settingsWindow.innerText('.SpellCheckerSetting .SelectSetting__select__multi-value__label');
            textboxString.should.equal('Afrikaans');

            await settingsWindow.isVisible('.SettingsModal__saving');

            await settingsWindow.click('[aria-label="Remove Afrikaans"]');

            await settingsWindow.isVisible('.SettingsModal__saving');

            textboxString = await settingsWindow.inputValue('#selectSetting_spellCheckerLocales');
            textboxString.should.equal('');
        });

        it('MM-T1288_2 should be able to cut and paste in the settings window', async () => {
            const textToCopy = 'Afrikaans';
            env.clipboard(textToCopy);

            const textbox = await settingsWindow.waitForSelector('#selectSetting_spellCheckerLocales');

            await textbox.selectText({force: true});
            robot.keyTap('x', [env.cmdOrCtrl]);
            let textValue = await textbox.getAttribute('value');
            textValue.should.equal('');

            await textbox.focus();
            robot.keyTap('v', [env.cmdOrCtrl]);
            textValue = await textbox.getAttribute('value');
            textValue.trim().should.equal('Afrikaans');
        });

        it('MM-T1288_3 should be able to copy and paste in the settings window', async () => {
            const textToCopy = 'Afrikaans';
            env.clipboard(textToCopy);

            const textbox = await settingsWindow.waitForSelector('#selectSetting_spellCheckerLocales');

            await textbox.selectText({force: true});
            robot.keyTap('c', [env.cmdOrCtrl]);
            await textbox.focus();
            await textbox.type('other-text');
            robot.keyTap('v', [env.cmdOrCtrl]);
            const textValue = await textbox.getAttribute('value');
            textValue.trim().should.equal('other-textAfrikaans');
        });
    });
});
