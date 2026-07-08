// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {openSettingsWindow} from '../../helpers/settingsWindow';

test.describe('settings/tray_icon_theme', () => {
    test(
        'MM-T4638 Settings - app icon theme (tray icon theme)',
        {tag: ['@P2', '@linux']},
        async ({electronApp}, testInfo) => {
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.click('#settingCategoryButton-general');
            await settingsWindow.click('#CheckSetting_showTrayIcon button');
            await settingsWindow.click('#RadioSetting_trayIconTheme_dark');
            await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")', {timeout: 15_000});
            const config = JSON.parse(fs.readFileSync(path.join(testInfo.outputDir, 'userdata', 'config.json'), 'utf-8'));
            expect(config.trayIconTheme).toBe('dark');
        },
    );
});
