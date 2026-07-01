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
        let testError: unknown;
        try {
            await autostartToggle.click();
            await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")', {timeout: 15_000});

            const updatedConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as {autostart: boolean};
            expect(updatedConfig.autostart).toBe(!initialConfig.autostart);
        } catch (error) {
            testError = error;
        } finally {
            // Restoring failure here would leave the real OS autostart entry toggled
            // for subsequent CI runs, so surface it loudly instead of swallowing it —
            // but don't let a restore failure mask an earlier test failure.
            try {
                const currentConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as {autostart: boolean};
                if (currentConfig.autostart !== initialConfig.autostart) {
                    await autostartToggle.click();
                    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")', {timeout: 15_000});
                }
            } catch (restoreError) {
                // eslint-disable-next-line no-console
                console.error(
                    'SET-01: failed to restore autostart to its original value — ' +
                    'the real OS autostart entry may be left toggled for subsequent runs.',
                    restoreError,
                );
                testError = testError ?? restoreError;
            }
        }
        if (testError) {
            throw testError;
        }
    },
);
