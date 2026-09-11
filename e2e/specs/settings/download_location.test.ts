// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {stubOpenDialogResults} from '../../helpers/dialog';
import {
    closeDownloadTestApp,
    launchAppWithDownloadsDir,
    startDownloadServer,
    triggerDownloadFromPopup,
    waitForDownloadFile,
} from '../../helpers/downloads';
import {waitForConfigValue} from '../../helpers/settingsConfig';
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

    test(
        'MM-T4031 Change download folder, cancel keeps previous folder, downloads use the new folder',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            // Native OS folder picker UI and Finder/Explorer "file selected" cannot
            // be driven by Playwright. dialog.showOpenDialog is stubbed.
            const filename = 'location-change.txt';
            const {url, close} = await startDownloadServer(filename, {contents: 'download location e2e'});

            const userDataDir = path.join(testInfo.outputDir, 'userdata');
            const initialDir = path.join(testInfo.outputDir, 'Downloads-initial');
            const desktopDir = path.join(testInfo.outputDir, 'Desktop');
            const documentsDir = path.join(testInfo.outputDir, 'Documents');
            const configFilePath = path.join(userDataDir, 'config.json');

            fs.mkdirSync(desktopDir, {recursive: true});
            fs.mkdirSync(documentsDir, {recursive: true});

            let app: Awaited<ReturnType<typeof launchAppWithDownloadsDir>> | undefined;
            try {
                app = await launchAppWithDownloadsDir(userDataDir, initialDir);
                const settingsWindow = await openSettingsWindow(app);
                await settingsWindow.click('#settingCategoryButton-general');
                await expect(settingsWindow.locator('#saveDownloadLocation')).toBeVisible();

                await stubOpenDialogResults(app, [{filePaths: [desktopDir]}]);
                await settingsWindow.click('#saveDownloadLocation');
                await waitForConfigValue(configFilePath, 'downloadLocation', desktopDir);
                await expect(settingsWindow.locator('.DownloadSetting input')).toHaveValue(desktopDir);

                await stubOpenDialogResults(app, [{canceled: true, filePaths: []}]);
                await settingsWindow.click('#saveDownloadLocation');
                await expect.poll(
                    () => JSON.parse(fs.readFileSync(configFilePath, 'utf-8')).downloadLocation,
                    {timeout: 5_000, message: 'Canceling the folder picker must keep the previous download location'},
                ).toBe(desktopDir);

                await stubOpenDialogResults(app, [{filePaths: [documentsDir]}]);
                await settingsWindow.click('#saveDownloadLocation');
                await waitForConfigValue(configFilePath, 'downloadLocation', documentsDir);
                await expect(settingsWindow.locator('.DownloadSetting input')).toHaveValue(documentsDir);
                await settingsWindow.close().catch(() => {});

                await triggerDownloadFromPopup(app, url);
                const savedPath = await waitForDownloadFile(userDataDir, documentsDir, filename);
                expect(savedPath.startsWith(documentsDir), 'Download must land in the newly selected folder').toBe(true);
                expect(fs.existsSync(path.join(desktopDir, filename))).toBe(false);
                expect(fs.existsSync(path.join(initialDir, filename))).toBe(false);
            } finally {
                if (app) {
                    await closeDownloadTestApp(app, userDataDir, initialDir);
                }
                await close();
            }
        },
    );
});
