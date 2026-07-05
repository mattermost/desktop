// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {openSettingsWindow} from '../../helpers/settingsWindow';

test.describe('settings/download_location', () => {
    test(
        'MM-T4031 Download location setting is visible and persisted in config (smoke)',
        {tag: ['@P2', '@all']},
        async ({electronApp}, testInfo) => {
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.click('#settingCategoryButton-advanced');
            await expect(settingsWindow.locator('#DownloadSetting_downloadLocation')).toBeVisible();
            const config = JSON.parse(fs.readFileSync(path.join(testInfo.outputDir, 'userdata', 'config.json'), 'utf-8'));
            expect(config).toHaveProperty('downloadLocation');
        },
    );
});
