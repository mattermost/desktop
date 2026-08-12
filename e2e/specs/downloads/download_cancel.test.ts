// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {
    closeDownloadTestApp,
    launchAppWithDownloadsDir,
    openDownloadsDropdown,
    readDownloadsState,
    startDownloadServer,
    triggerDownloadFromPopup,
    waitForDownloadState,
} from '../../helpers/downloads';

test(
    'MM-T6130 in-progress download can be cancelled from the downloads dropdown menu',
    {tag: ['@P1', '@all']},
    async ({}, testInfo) => {
        const filename = 'slow-cancel.txt';
        const {url, close} = await startDownloadServer(filename, {slow: true});

        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadLocation = path.join(testInfo.outputDir, 'Downloads');
        const app = await launchAppWithDownloadsDir(userDataDir, downloadLocation);

        try {
            await Promise.all([
                triggerDownloadFromPopup(app, url),
                waitForDownloadState(userDataDir, filename, 'progressing'),
            ]);

            const {downloadsWindow} = await openDownloadsDropdown(app);
            await downloadsWindow.hover('.DownloadsDropdown__File');
            await downloadsWindow.click('.DownloadsDropdown__File__Body__ThreeDotButton');

            let menuWindow = app.windows().find((window) => window.url().includes('downloadsDropdownMenu.html'));
            if (!menuWindow) {
                menuWindow = await app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('downloadsDropdownMenu.html'),
                    timeout: 10_000,
                });
            }
            await menuWindow.waitForLoadState();
            await menuWindow.click('text=Cancel Download');

            await expect.poll(
                () => readDownloadsState(userDataDir)[filename]?.state,
                {timeout: 15_000, message: 'Cancelled download should be marked cancelled in downloads.json'},
            ).toMatch(/cancelled|interrupted/);
        } finally {
            await Promise.allSettled([
                closeDownloadTestApp(app, userDataDir, downloadLocation),
                close(),
            ]);
        }
    },
);
