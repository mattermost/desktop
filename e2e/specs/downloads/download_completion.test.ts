// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';

test(
    'downloaded file exists on disk after download completes',
    {tag: ['@P1', '@all']},
    async ({electronApp, mainWindow}, testInfo) => {
        // This test requires a real downloadable URL — skip if not in live env
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required for download test');
            return;
        }

        // Navigate to the download URL in one of the external views
        const externalWin = electronApp.windows().find((w) =>
            !w.url().startsWith('mattermost-desktop://'),
        );
        if (!externalWin) {
            test.skip(true, 'No external window available for download trigger');
            return;
        }

        const downloadsDir = path.join(testInfo.outputDir, 'Downloads');
        fs.mkdirSync(downloadsDir, {recursive: true});

        // Configure downloads directory via Electron's session
        await electronApp.evaluate(({session}, dir) => {
            session.defaultSession.setDownloadPath(dir);
        }, downloadsDir);

        // Trigger a download via a known URL from one of the demo servers
        // Using a publicly available small file for the test
        const downloadUrl = 'https://example.com/';  // Replace with actual test file URL in live env

        const downloadPromise = electronApp.evaluate(({webContents, BrowserWindow}) => {
            return new Promise<string>((resolve, reject) => {
                const wc = BrowserWindow.getAllWindows()[0]?.webContents;
                if (!wc) {
                    reject(new Error('No main window webContents'));
                    return;
                }
                wc.session.once('will-download', (_event, item) => {
                    item.once('done', (_e, state) => {
                        if (state === 'completed') {
                            resolve(item.getSavePath());
                        } else {
                            reject(new Error(`Download failed: ${state}`));
                        }
                    });
                });
            });
        });

        // Navigate to trigger the download
        await externalWin.goto(downloadUrl);

        const savedPath = await Promise.race([
            downloadPromise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Download timed out')), 30_000),
            ),
        ]);

        expect(fs.existsSync(savedPath as string)).toBe(true);
        const stat = fs.statSync(savedPath as string);
        expect(stat.size).toBeGreaterThan(0);
    },
);
