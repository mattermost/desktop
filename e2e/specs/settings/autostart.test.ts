// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {openSettingsWindow} from '../../helpers/settingsWindow';

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
