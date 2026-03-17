// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, emptyConfig} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';

function readJsonFile<T>(filePath: string): T | undefined {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
        return undefined;
    }
}

async function startDownloadServer(filename: string, contents: string) {
    const server = http.createServer((request, response) => {
        if (request.url === '/download.txt') {
            response.writeHead(200, {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': Buffer.byteLength(contents),
            });
            response.end(contents);
            return;
        }

        response.writeHead(200, {'Content-Type': 'text/html'});
        response.end(`
            <!doctype html>
            <html>
            <body>
                <a id="download-link" href="/download.txt">Download file</a>
            </body>
            </html>
        `);
    });

    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', () => resolve()),
    );
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start local download server');
    }

    return {
        server,
        url: `http://127.0.0.1:${address.port}`,
    };
}

test(
    'downloaded file exists on disk after download completes',
    {tag: ['@P1', '@all']},
    async ({}, testInfo) => {
        const filename = 'downloaded-file.txt';
        const fileContents = 'download completion verification';
        const {server, url} = await startDownloadServer(filename, fileContents);

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
            const mainWindow = app.
                windows().
                find((window) => window.url().includes('index'));
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
                (global as any).__downloadCompletionPopup = popup;
            }, url);

            const popupWindow = await popupPromise;
            await popupWindow.waitForLoadState();
            await popupWindow.click('#download-link');
            await expect.
                poll(() => fs.existsSync(savedPath), {timeout: 15_000}).
                toBe(true);
            await expect.
                poll(() => fs.readFileSync(savedPath, 'utf-8'), {timeout: 15_000}).
                toBe(fileContents);
            await expect.
                poll(
                    () => {
                        const downloads = readJsonFile<Record<string, { state?: string }>>(
                            path.join(userDataDir, 'downloads.json'),
                        );
                        return downloads?.[filename]?.state;
                    },
                    {timeout: 15_000},
                ).
                toBe('completed');
        } finally {
            await app.close().catch(() => {});
            await waitForLockFileRelease(userDataDir).catch(() => {});
            await new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve())),
            );
            fs.rmSync(downloadsDir, {recursive: true, force: true});
        }
    },
);
