// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {closeDownloadTestApp, launchAppWithDownloadsDir, openDownloadsDropdown} from '../../helpers/downloads';

const completedFile = {
    addedAt: Date.UTC(2022, 7, 8, 10),
    filename: 'file1.txt',
    mimeType: 'text/plain',
    progress: 100,
    receivedBytes: 1024,
    state: 'completed',
    totalBytes: 1024,
    type: 'file',
};

const secondFile = {
    ...completedFile,
    filename: 'file2.txt',
    addedAt: Date.UTC(2022, 7, 8, 11),
};

test(
    'MM-T6131 clear all removes every completed download from the dropdown',
    {tag: ['@P1', '@all']},
    async ({}, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadLocation = path.join(testInfo.outputDir, 'Downloads');
        fs.mkdirSync(downloadLocation, {recursive: true});
        fs.writeFileSync(path.join(downloadLocation, completedFile.filename), 'file1');
        fs.writeFileSync(path.join(downloadLocation, secondFile.filename), 'file2');

        const downloads = {
            [completedFile.filename]: {
                ...completedFile,
                location: path.join(downloadLocation, completedFile.filename),
            },
            [secondFile.filename]: {
                ...secondFile,
                location: path.join(downloadLocation, secondFile.filename),
            },
        };
        fs.mkdirSync(userDataDir, {recursive: true});
        fs.writeFileSync(path.join(userDataDir, 'downloads.json'), JSON.stringify(downloads));

        const app = await launchAppWithDownloadsDir(userDataDir, downloadLocation);

        try {
            const {downloadsWindow} = await openDownloadsDropdown(app);
            await downloadsWindow.waitForSelector('.DownloadsDropdown__File', {timeout: 10_000});
            await expect.poll(
                () => downloadsWindow.locator('.DownloadsDropdown__File').count(),
                {timeout: 10_000},
            ).toBe(2);

            await downloadsWindow.click('.DownloadsDropdown__clearAllButton');

            await expect.poll(
                () => Object.keys(JSON.parse(fs.readFileSync(path.join(userDataDir, 'downloads.json'), 'utf-8'))).length,
                {timeout: 10_000},
            ).toBe(0);
            await expect.poll(
                () => downloadsWindow.locator('.DownloadsDropdown__File').count(),
                {timeout: 10_000},
            ).toBe(0);
        } finally {
            await closeDownloadTestApp(app, userDataDir, downloadLocation);
        }
    },
);
