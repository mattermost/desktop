// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {
    closeDownloadTestApp,
    launchAppWithDownloadsDir,
    readDownloadsState,
    triggerDownloadFromPopup,
} from '../../helpers/downloads';

// ── MM-T1538: Download a video ────────────────────────────────────────
// Verifies a real end-to-end download path for a video MIME type:
//   1. Local HTTP server serves a fake .mp4 (small binary buffer)
//   2. A BrowserWindow loaded inside the Electron app clicks the link
//   3. DownloadsManager (src/main/downloadsManager.ts) handles will-download
//   4. We assert: the file lands on disk AND downloads.json records it
//      with state "completed"

async function startVideoServer(filename: string, body: Buffer) {
    const server = http.createServer((request, response) => {
        if (request.url === '/video.mp4') {
            response.writeHead(200, {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': body.length,
            });
            response.end(body);
            return;
        }

        response.writeHead(200, {'Content-Type': 'text/html'});
        response.end(`
            <!doctype html>
            <html>
            <body>
                <a id="download-link" href="/video.mp4">Download video</a>
            </body>
            </html>
        `);
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start local video download server');
    }

    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        }),
    };
}

test(
    'MM-T1538 Download a video',
    {tag: ['@P2', '@all']},
    async ({}, testInfo) => {
        const filename = 'sample-video.mp4';

        const videoBody = Buffer.from([
            0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
            0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
            0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
        ]);

        const {url, close: closeVideoServer} = await startVideoServer(filename, videoBody);

        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadLocation = path.join(testInfo.outputDir, 'Downloads');
        const app = await launchAppWithDownloadsDir(userDataDir, downloadLocation);
        const savedPath = path.join(downloadLocation, filename);

        try {
            await triggerDownloadFromPopup(app, url);

            await expect.poll(() => fs.existsSync(savedPath), {timeout: 15_000}).toBe(true);
            await expect.poll(() => fs.readFileSync(savedPath).equals(videoBody), {timeout: 15_000}).toBe(true);
            await expect.poll(
                () => readDownloadsState(userDataDir)[filename]?.state,
                {timeout: 15_000},
            ).toBe('completed');
        } finally {
            await closeDownloadTestApp(app, userDataDir, downloadLocation);
            await closeVideoServer();
        }
    },
);
