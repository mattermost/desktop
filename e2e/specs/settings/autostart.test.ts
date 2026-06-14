// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';

const SHOW_SETTINGS_WINDOW = 'show-settings-window';

async function openSettingsWindow(electronApp: import('playwright').ElectronApplication) {
    const existingWindow = electronApp.windows().find((window) => window.url().includes('settings'));
    if (existingWindow) {
        await existingWindow.waitForLoadState().catch(() => {});
        return existingWindow;
    }

    await electronApp.evaluate(({ipcMain}, showWindow) => {
        ipcMain.emit(showWindow);
    }, SHOW_SETTINGS_WINDOW);

    const settingsWindow = electronApp.windows().find((window) => window.url().includes('settings')) ??
        await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
            timeout: 30_000,
        });
    await settingsWindow.waitForLoadState();
    return settingsWindow;
}

test(
    'SET-01 toggling autostart updates config.json',
    {tag: ['@P1', '@win32', '@linux']},
    async ({electronApp}, testInfo) => {
        if (process.platform === 'darwin') {
            test.skip(true, 'Autostart setting is not shown on macOS');
            return;
        }

        const configFilePath = path.join(testInfo.outputDir, 'userdata', 'config.json');
        const settingsWindow = await openSettingsWindow(electronApp);
        await settingsWindow.click('#settingCategoryButton-general');

        const autostartToggle = settingsWindow.locator('#CheckSetting_autostart button');
        await autostartToggle.waitFor({state: 'visible', timeout: 10_000});

        const initialConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as {autostart: boolean};
        await autostartToggle.click();
        await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")', {timeout: 15_000});

        const updatedConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as {autostart: boolean};
        expect(updatedConfig.autostart).toBe(!initialConfig.autostart);
    },
);
