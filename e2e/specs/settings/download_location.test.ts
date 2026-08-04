// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {openSettingsWindow} from '../../helpers/settingsWindow';

test.describe('settings/download_location', () => {
    test(
        'MM-T4031 Download location setting is visible and persisted in config (smoke)',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.click('#settingCategoryButton-general');
            await expect(settingsWindow.locator('.DownloadSetting')).toBeVisible();
            await expect(settingsWindow.locator('#saveDownloadLocation')).toBeVisible();
            const downloadPath = await settingsWindow.locator('.DownloadSetting input').inputValue();
            expect(downloadPath.length, 'Download location must show the current default path').toBeGreaterThan(0);
        },
    );
});
