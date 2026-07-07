// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {
    closeDownloadTestApp,
    launchAppWithDownloadsDir,
    openDownloadsDropdown,
    startDownloadServer,
    triggerDownloadFromPopup,
    waitForDownloadFile,
} from '../../helpers/downloads';

test(
    'MM-T6133 completed download can be opened from the downloads dropdown',
    {tag: ['@P1', '@all']},
    async ({}, testInfo) => {
        const filename = 'open-me.txt';
        const fileContents = 'open download test';
        const {url, close} = await startDownloadServer(filename, {contents: fileContents});

        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadLocation = path.join(testInfo.outputDir, 'Downloads');
        const app = await launchAppWithDownloadsDir(userDataDir, downloadLocation);

        try {
            await triggerDownloadFromPopup(app, url);
            await waitForDownloadFile(userDataDir, downloadLocation, filename);

            await app.evaluate(({shell}) => {
                const refs = (global as any).__e2eTestRefs;
                refs.__e2eOpenedPaths = [] as string[];
                shell.openPath = async (targetPath: string) => {
                    refs.__e2eOpenedPaths.push(targetPath);
                    return '';
                };
            });

            const {downloadsWindow} = await openDownloadsDropdown(app);
            await downloadsWindow.click('.DownloadsDropdown__File');

            await expect.poll(async () => {
                return app.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    return (refs.__e2eOpenedPaths as string[] | undefined)?.length ?? 0;
                });
            }, {timeout: 10_000}).toBeGreaterThan(0);

            const openedPath = await app.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                return (refs.__e2eOpenedPaths as string[])[0];
            });
            expect(openedPath).toContain(filename);
        } finally {
            await Promise.allSettled([
                closeDownloadTestApp(app, userDataDir, downloadLocation),
                close(),
            ]);
        }
    },
);
