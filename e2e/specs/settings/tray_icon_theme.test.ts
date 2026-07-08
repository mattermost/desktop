// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {openSettingsWindow} from '../../helpers/settingsWindow';
import {waitForConfigValue} from '../../helpers/settingsConfig';

test.describe('settings/tray_icon_theme', () => {
    test(
        'MM-T4638 Settings - app icon theme (tray icon theme)',
        {tag: ['@P2', '@linux']},
        async ({electronApp}, testInfo) => {
            const configFilePath = path.join(testInfo.outputDir, 'userdata', 'config.json');
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.click('#settingCategoryButton-general');
            await settingsWindow.click('#CheckSetting_showTrayIcon button');
            await settingsWindow.click('#RadioSetting_trayIconTheme_dark');
            await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")', {timeout: 15_000});
            await waitForConfigValue(configFilePath, 'trayIconTheme', 'dark');
        },
    );
});
