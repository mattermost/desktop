// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, emptyConfig} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';

async function startSlowDownloadServer(filename: string, chunk = 'slow-download-chunk-') {
    const server = http.createServer((request, response) => {
        if (request.url === '/download.txt') {
            response.writeHead(200, {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });

            let sentChunks = 0;
            const timer = setInterval(() => {
                sentChunks += 1;
                response.write(`${chunk}${sentChunks}\n`);

                if (sentChunks === 10) {
                    clearInterval(timer);
                    response.end();
                }
            }, 150);
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

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start local download server');
    }

    return {
        server,
        url: `http://127.0.0.1:${address.port}`,
    };
}

test.describe('downloads/downloads_manager', () => {
    test('MM-22239 should open downloads dropdown when a download starts', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const filename = 'slow-download.txt';
        const {server, url} = await startSlowDownloadServer(filename);

        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadsDir = path.join(testInfo.outputDir, 'Downloads');
        const config = {
            ...emptyConfig,
            downloadLocation: downloadsDir,
        };

        fs.mkdirSync(userDataDir, {recursive: true});
        fs.mkdirSync(downloadsDir, {recursive: true});
        fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config));

        const {_electron: electron} = await import('playwright');
        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

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
                (global as any).__downloadsManagerPopup = popup;
            }, url);

            const popupWindow = await popupPromise;
            await popupWindow.waitForLoadState();
            const browserWindow = await app.browserWindow(mainWindow!);

            await popupWindow.click('#download-link');

            await expect.poll(() => {
                try {
                    const downloads = JSON.parse(fs.readFileSync(path.join(userDataDir, 'downloads.json'), 'utf-8'));
                    return downloads[filename]?.state;
                } catch {
                    return undefined;
                }
            }, {timeout: 15_000}).toBe('completed');

            await expect.poll(() => {
                return browserWindow.evaluate((window) => {
                    const dropdownView = (window as any).contentView.children.find(
                        (view: any) => view.webContents.getURL().includes('downloadsDropdown.html'),
                    );
                    return dropdownView?.getBounds().height ?? 0;
                });
            }, {timeout: 15_000}).toBeGreaterThan(0);
        } finally {
            await app.close().catch(() => {});
            await waitForLockFileRelease(userDataDir).catch(() => {});
            await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
            fs.rmSync(downloadsDir, {recursive: true, force: true});
        }
    });
});
