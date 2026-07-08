// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {
    readConfigValue,
    toggleAutostartSetting,
    waitForConfigValue,
} from '../../helpers/settingsConfig';
import {openSettingsWindow} from '../../helpers/settingsWindow';

test.describe('windows_and_linux_only/autostart', () => {
    test.describe('MM-T1289 Start app on login saves autostart preference', () => {
        test.use({appConfig: {...demoConfig, autostart: false}});

        test(
            'MM-T1289 Start app on login saves autostart preference',
            {tag: ['@P2', '@win32', '@linux']},
            async ({electronApp}, testInfo) => {
                const configFilePath = path.join(testInfo.outputDir, 'userdata', 'config.json');
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.click('#settingCategoryButton-general');

                expect(readConfigValue<boolean>(configFilePath, 'autostart')).toBe(false);
                await toggleAutostartSetting(settingsWindow, configFilePath);
            },
        );
    });

    test(
        'MM-T1290 Do not start app on login saves autostart preference',
        {tag: ['@P2', '@win32', '@linux']},
        async ({electronApp}, testInfo) => {
            const configFilePath = path.join(testInfo.outputDir, 'userdata', 'config.json');
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.click('#settingCategoryButton-general');

            if (readConfigValue<boolean>(configFilePath, 'autostart')) {
                await toggleAutostartSetting(settingsWindow, configFilePath);
            }
            await waitForConfigValue(configFilePath, 'autostart', false);
        },
    );

    test(
        'MM-T2951 Desktop App autostart setting appears on Windows and Linux',
        {tag: ['@P2', '@win32', '@linux']},
        async ({electronApp}) => {
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.click('#settingCategoryButton-general');
            await expect(settingsWindow.locator('#CheckSetting_autostart')).toBeVisible();
        },
    );

    test(
        'MM-T2952 Desktop App autostart toggle persists to config',
        {tag: ['@P2', '@win32', '@linux']},
        async ({electronApp}, testInfo) => {
            const configFilePath = path.join(testInfo.outputDir, 'userdata', 'config.json');
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.click('#settingCategoryButton-general');
            const {before} = await toggleAutostartSetting(settingsWindow, configFilePath);
            await toggleAutostartSetting(settingsWindow, configFilePath);
            await waitForConfigValue(configFilePath, 'autostart', before);
        },
    );
});
