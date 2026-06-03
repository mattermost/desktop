// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {cmdOrCtrl} from '../../helpers/config';

const SHOW_SETTINGS_WINDOW = 'show-settings-window';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;

async function openSettingsWindow(electronApp: ElectronApplication) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const existingWindow = electronApp.windows().find((window) => window.url().includes('settings'));
        if (existingWindow) {
            await existingWindow.waitForLoadState().catch(() => {});
            return existingWindow;
        }

        try {
            await electronApp.evaluate(({ipcMain}, showWindow) => {
                ipcMain.emit(showWindow);
            }, SHOW_SETTINGS_WINDOW);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Execution context was destroyed') || attempt === 4) {
                throw error;
            }
        }

        try {
            const settingsWindow = await electronApp.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
                timeout: 3_000,
            });
            await settingsWindow.waitForLoadState().catch(() => {});
            return settingsWindow;
        } catch (error) {
            if (attempt === 4) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    throw new Error('Settings window did not open');
}

test.describe('settings/keyboard_shortcuts', () => {
    test.describe('MM-T1288 Manipulating Text', () => {
        test('MM-T1288_1 should be able to select and deselect language in the settings window', {tag: ['@P2', '@all']}, async ({electronApp}) => {
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.waitForSelector('#settingCategoryButton-language');
            await settingsWindow.click('#settingCategoryButton-language');
            const textbox = await settingsWindow.waitForSelector('#selectSetting_spellCheckerLocales');
            await textbox.scrollIntoViewIfNeeded();

            let textboxString: string;
            await settingsWindow.click('#selectSetting_spellCheckerLocales');
            await settingsWindow.type('#selectSetting_spellCheckerLocales', 'Afrikaans');
            await settingsWindow.keyboard.press('Tab');

            textboxString = await settingsWindow.innerText('.SpellCheckerSetting .SelectSetting__select__multi-value__label');
            expect(textboxString).toBe('Afrikaans');

            await settingsWindow.click('[aria-label="Remove Afrikaans"]');

            textboxString = await settingsWindow.inputValue('#selectSetting_spellCheckerLocales');
            expect(textboxString).toBe('');
        });

        test('MM-T1288_2 should be able to cut and paste in the settings window', {tag: ['@P2', '@all']}, async ({electronApp}) => {
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.waitForSelector('#settingCategoryButton-language');
            await settingsWindow.click('#settingCategoryButton-language');
            const textbox = await settingsWindow.waitForSelector('#selectSetting_spellCheckerLocales');
            await textbox.scrollIntoViewIfNeeded();

            await textbox.fill('Afrikaans');
            await textbox.selectText({force: true});
            const cutKey = cmdOrCtrl === 'command' ? 'Meta+x' : 'Control+x';
            await settingsWindow.keyboard.press(cutKey);
            let textValue = await textbox.getAttribute('value');
            expect(textValue).toBe('');

            await textbox.focus();
            const pasteKey = cmdOrCtrl === 'command' ? 'Meta+v' : 'Control+v';
            await settingsWindow.keyboard.press(pasteKey);
            textValue = await textbox.getAttribute('value');
            expect(textValue?.trim()).toBe('Afrikaans');
        });

        test('MM-T1288_3 should be able to copy and paste in the settings window', {tag: ['@P2', '@all']}, async ({electronApp}) => {
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.waitForSelector('#settingCategoryButton-language');
            await settingsWindow.click('#settingCategoryButton-language');
            const textbox = await settingsWindow.waitForSelector('#selectSetting_spellCheckerLocales');
            await textbox.scrollIntoViewIfNeeded();

            await textbox.fill('Afrikaans');
            await textbox.selectText({force: true});
            const copyKey = cmdOrCtrl === 'command' ? 'Meta+c' : 'Control+c';
            await settingsWindow.keyboard.press(copyKey);
            await textbox.focus();
            await textbox.type('other-text');
            const pasteKey = cmdOrCtrl === 'command' ? 'Meta+v' : 'Control+v';
            await settingsWindow.keyboard.press(pasteKey);
            const textValue = await textbox.getAttribute('value');
            expect(textValue?.trim()).toBe('other-textAfrikaans');
        });
    });
});
