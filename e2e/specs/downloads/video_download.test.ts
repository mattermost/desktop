// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, emptyConfig} from '../../helpers/config';
import {closeElectronAppFast} from '../../helpers/electronApp';

// ── MM-T1538: Download a video ────────────────────────────────────────
// Verifies a real end-to-end download path for a video MIME type:
//   1. Local HTTP server serves a fake .mp4 (small binary buffer)
//   2. A BrowserWindow loaded inside the Electron app clicks the link
//   3. DownloadsManager (src/main/downloadsManager.ts) handles will-download
//   4. We assert: the file lands on disk AND downloads.json records it
//      with state "completed"
//
// Pattern mirrors download_completion.test.ts so the two tests differ only
// in MIME type and content — keeping the download flow exercised for the
// file type MM-T1538 specifically targets (video) without duplicating the
// scaffolding.

function readJsonFile<T>(filePath: string): T | undefined {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
        return undefined;
    }
}

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

    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', () => resolve()),
    );
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start local video download server');
    }

    return {
        server,
        url: `http://127.0.0.1:${address.port}`,
    };
}

test(
    'MM-T1538 Download a video',
    {tag: ['@P2', '@all']},
    async ({}, testInfo) => {
        const filename = 'sample-video.mp4';

        // Minimal .mp4 — magic bytes are enough for the download-manager
        // pipeline; we never play the file, only assert it landed on disk.
        const videoBody = Buffer.from([
            0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
            0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
            0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
        ]);

        const {server, url} = await startVideoServer(filename, videoBody);

        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadsDir = path.join(testInfo.outputDir, 'Downloads');
        const config = {
            ...emptyConfig,
            downloadLocation: downloadsDir,
        };

        fs.mkdirSync(userDataDir, {recursive: true});
        fs.mkdirSync(downloadsDir, {recursive: true});
        fs.writeFileSync(
            path.join(userDataDir, 'config.json'),
            JSON.stringify(config),
        );

        const {_electron: electron} = await import('playwright');
        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [
                appDir,
                `--user-data-dir=${userDataDir}`,
                '--no-sandbox',
                '--disable-gpu',
            ],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

        const savedPath = path.join(downloadsDir, filename);

        try {
            await waitForAppReady(app);
            const mainWindow = app.windows().find((window) => window.url().includes('index'));
            expect(mainWindow).toBeDefined();
            await mainWindow!.waitForLoadState();

            const popupPromise = app.waitForEvent('window', {
                predicate: (window) => window.url().startsWith(url),
                timeout: 15_000,
            });

            await app.evaluate(async ({BrowserWindow}, popupUrl) => {
                const popup = new BrowserWindow({
                    show: true,
                    width: 900,
                    height: 700,
                });
                await popup.loadURL(popupUrl);
                (global as any).__videoDownloadPopup = popup;
            }, url);

            const popupWindow = await popupPromise;
            await popupWindow.waitForLoadState();
            await popupWindow.click('#download-link');

            await expect.
                poll(() => fs.existsSync(savedPath), {timeout: 15_000}).
                toBe(true);

            // Verify the downloaded bytes match what we served
            await expect.
                poll(() => fs.readFileSync(savedPath).equals(videoBody), {timeout: 15_000}).
                toBe(true);

            // DownloadsManager must record the download as completed
            await expect.
                poll(
                    () => {
                        const downloads = readJsonFile<Record<string, {state?: string; mimeType?: string}>>(
                            path.join(userDataDir, 'downloads.json'),
                        );
                        return downloads?.[filename]?.state;
                    },
                    {timeout: 15_000},
                ).
                toBe('completed');
        } finally {
            try {
                await closeElectronAppFast(app, userDataDir);
            } finally {
                await new Promise<void>((resolve, reject) =>
                    server.close((error) => (error ? reject(error) : resolve())),
                );
                fs.rmSync(downloadsDir, {recursive: true, force: true});
            }
        }
    },
);
