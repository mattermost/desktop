// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {
    closeDownloadTestApp,
    launchAppWithDownloadsDir,
    openDownloadsDropdown,
    startDownloadServer,
    triggerDownloadFromPopup,
} from '../../helpers/downloads';

test(
    'DL-05 completed download can be opened from the downloads dropdown',
    {tag: ['@P1', '@all']},
    async ({}, testInfo) => {
        const filename = 'open-me.txt';
        const fileContents = 'open download test';
        const {url, close} = await startDownloadServer(filename, {contents: fileContents});

        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadLocation = path.join(testInfo.outputDir, 'Downloads');
        const savedPath = path.join(downloadLocation, filename);
        const app = await launchAppWithDownloadsDir(userDataDir, downloadLocation);

        try {
            await triggerDownloadFromPopup(app, url);
            await expect.poll(() => fs.existsSync(savedPath), {timeout: 15_000}).toBe(true);

            await app.evaluate(({shell}) => {
                (global as any).__e2eOpenedPaths = [] as string[];
                const original = shell.openPath.bind(shell);
                shell.openPath = async (targetPath: string) => {
                    (global as any).__e2eOpenedPaths.push(targetPath);
                    return original(targetPath);
                };
            });

            const {downloadsWindow} = await openDownloadsDropdown(app);
            await downloadsWindow.click('.DownloadsDropdown__File');

            await expect.poll(async () => {
                return app.evaluate(() => ((global as any).__e2eOpenedPaths as string[] | undefined)?.length ?? 0);
            }, {timeout: 10_000}).toBeGreaterThan(0);

            const openedPath = await app.evaluate(() => ((global as any).__e2eOpenedPaths as string[])[0]);
            expect(openedPath).toContain(filename);
        } finally {
            await closeDownloadTestApp(app, userDataDir, downloadLocation);
            await close();
        }
    },
);
