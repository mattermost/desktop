// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {openSettingsWindow} from '../../helpers/settingsWindow';

async function toggleAutostart(settingsWindow: Awaited<ReturnType<typeof openSettingsWindow>>, configFilePath: string) {
    const autostartToggle = settingsWindow.locator('#CheckSetting_autostart button');
    await autostartToggle.waitFor({state: 'visible', timeout: 10_000});
    const before = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')).autostart as boolean;
    await autostartToggle.click();
    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")', {timeout: 15_000});
    const after = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')).autostart as boolean;
    expect(after).toBe(!before);
    return {before, after};
}

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

                expect(JSON.parse(fs.readFileSync(configFilePath, 'utf-8')).autostart).toBe(false);
                await toggleAutostart(settingsWindow, configFilePath);
                expect(JSON.parse(fs.readFileSync(configFilePath, 'utf-8')).autostart).toBe(true);
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

            const initial = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')).autostart as boolean;
            if (initial) {
                await toggleAutostart(settingsWindow, configFilePath);
            }
            expect(JSON.parse(fs.readFileSync(configFilePath, 'utf-8')).autostart).toBe(false);
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
            const {before} = await toggleAutostart(settingsWindow, configFilePath);
            await toggleAutostart(settingsWindow, configFilePath);
            expect(JSON.parse(fs.readFileSync(configFilePath, 'utf-8')).autostart).toBe(before);
        },
    );
});
