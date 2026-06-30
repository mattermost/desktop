// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';

const SHOW_SETTINGS_WINDOW = 'show-settings-window';

async function openSettingsWindow(electronApp: import('playwright').ElectronApplication) {
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
            const settingsWindow = electronApp.windows().find((window) => window.url().includes('settings')) ??
                await electronApp.waitForEvent('window', {
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

test(
    'SET-01 toggling autostart updates config.json',
    {tag: ['@P1', '@win32', '@linux']},
    async ({electronApp}, testInfo) => {
        const configFilePath = path.join(testInfo.outputDir, 'userdata', 'config.json');
        const settingsWindow = await openSettingsWindow(electronApp);
        await settingsWindow.click('#settingCategoryButton-general');

        const autostartToggle = settingsWindow.locator('#CheckSetting_autostart button');
        await autostartToggle.waitFor({state: 'visible', timeout: 10_000});

        const initialConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as {autostart: boolean};
        try {
            await autostartToggle.click();
            await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")', {timeout: 15_000});

            const updatedConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as {autostart: boolean};
            expect(updatedConfig.autostart).toBe(!initialConfig.autostart);
        } finally {
            const currentConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as {autostart: boolean};
            if (currentConfig.autostart !== initialConfig.autostart) {
                await autostartToggle.click();
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")', {timeout: 15_000});
            }
        }
    },
);
