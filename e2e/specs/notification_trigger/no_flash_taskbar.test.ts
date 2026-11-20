// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {demoConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {getFlashFrameCalls, installFlashFrameSpy, restoreFlashFrameSpy} from '../../helpers/methodSpy';
import {triggerNotificationEffects} from '../../helpers/notificationEffects';
import {openSettingsWindow} from '../../helpers/settingsWindow';

const flashEnabledConfig = {
    ...demoConfig,
    notifications: {...demoConfig.notifications, flashWindow: 2},
};

test.describe('notification_trigger/no_flash_taskbar', () => {
    test.use({appConfig: flashEnabledConfig});
    test.setTimeout(120_000);

    test(
        'MM-T1294 Do not flash taskbar icon — Windows & Linux ONLY',
        {tag: ['@P2', '@win32', '@linux']},
        async ({electronApp}, testInfo) => {
            await waitForAppReady(electronApp);

            const releaseLock = await acquireExclusiveLock('flash-taskbar-state');
            try {
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.click('#settingCategoryButton-notifications');
                const flashToggle = settingsWindow.locator('#CheckSetting_flashWindow button');
                await flashToggle.waitFor({state: 'visible', timeout: 10_000});
                await expect(flashToggle).toHaveAttribute('aria-checked', 'true');
                await flashToggle.click();
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")', {timeout: 15_000});

                const configFilePath = path.join(testInfo.outputDir, 'userdata', 'config.json');
                await expect.poll(() => {
                    try {
                        return JSON.parse(fs.readFileSync(configFilePath, 'utf-8')).notifications?.flashWindow;
                    } catch {
                        return undefined;
                    }
                }, {timeout: 15_000, message: 'Unchecking flash taskbar must persist flashWindow: 0'}).toBe(0);

                await settingsWindow.close().catch(() => {});

                await installFlashFrameSpy(electronApp);

                try {
                    await triggerNotificationEffects(electronApp, true);

                    await expect.poll(
                        () => getFlashFrameCalls(electronApp),
                        {timeout: 10_000, message: 'flashFrame(true) must not be called when flashWindow is disabled'},
                    ).not.toContain(true);
                } finally {
                    await restoreFlashFrameSpy(electronApp);
                }
            } finally {
                await releaseLock();
            }
        },
    );
});
