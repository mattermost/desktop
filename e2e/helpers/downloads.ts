// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import type {ElectronApplication} from 'playwright';
import {expect} from '@playwright/test';

import {waitForAppReady} from './appReadiness';
import {electronBinaryPath, appDir, emptyConfig} from './config';
import {waitForLockFileRelease} from './cleanup';

export type DownloadServer = {
    server: http.Server;
    url: string;
    close: () => Promise<void>;
};

export async function startDownloadServer(
    filename: string,
    options?: {contents?: string; slow?: boolean},
): Promise<DownloadServer> {
    const contents = options?.contents ?? 'download test contents';
    const slow = options?.slow ?? false;

    const server = http.createServer((request, response) => {
        if (request.url === '/download.txt') {
            if (slow) {
                response.writeHead(200, {
                    'Content-Type': 'text/plain',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                });
                let sentChunks = 0;
                const timer = setInterval(() => {
                    sentChunks += 1;
                    response.write(`chunk-${sentChunks}\n`);
                    if (sentChunks === 40) {
                        clearInterval(timer);
                        response.end();
                    }
                }, 300);
                return;
            }

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

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start local download server');
    }

    return {
        server,
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        }),
    };
}

export async function launchAppWithDownloadsDir(userDataDir: string, downloadLocation: string) {
    const config = {
        ...emptyConfig,
        downloadLocation,
    };

    fs.mkdirSync(userDataDir, {recursive: true});
    fs.mkdirSync(downloadLocation, {recursive: true});
    fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config));

    const {_electron: electron} = await import('playwright');
    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });
    await waitForAppReady(app);
    return app;
}

export async function openDownloadsDropdown(app: ElectronApplication) {
    const mainWindow = app.windows().find((window) => window.url().includes('index')) ??
        await app.waitForEvent('window', {
            predicate: (window) => window.url().includes('index'),
            timeout: 15_000,
        });
    await mainWindow.waitForLoadState();
    await mainWindow.bringToFront();

    const button = await mainWindow.waitForSelector('.DownloadsDropdownButton');
    await button.click();

    let downloadsWindow = app.windows().find((window) => window.url().includes('downloadsDropdown.html'));
    if (!downloadsWindow) {
        downloadsWindow = await app.waitForEvent('window', {
            predicate: (window) => window.url().includes('downloadsDropdown.html'),
            timeout: 10_000,
        });
    }
    await downloadsWindow.waitForLoadState();
    await downloadsWindow.bringToFront();
    await downloadsWindow.waitForSelector('.DownloadsDropdown', {state: 'visible', timeout: 15_000});
    return {mainWindow, downloadsWindow};
}

export async function triggerDownloadFromPopup(app: ElectronApplication, popupUrl: string) {
    const popupPromise = app.waitForEvent('window', {
        predicate: (window) => window.url().startsWith(popupUrl),
        timeout: 15_000,
    });

    await app.evaluate(async ({BrowserWindow}, url) => {
        const popup = new BrowserWindow({
            show: true,
            width: 900,
            height: 700,
        });
        await popup.loadURL(url);
        (global as any).__e2eDownloadPopup = popup;
    }, popupUrl);

    const popupWindow = await popupPromise;
    await popupWindow.waitForLoadState();
    await popupWindow.click('#download-link');
    return popupWindow;
}

export function readDownloadsState(userDataDir: string): Record<string, {state?: string; location?: string}> {
    try {
        return JSON.parse(fs.readFileSync(path.join(userDataDir, 'downloads.json'), 'utf-8'));
    } catch {
        return {};
    }
}

export async function waitForDownloadFile(
    userDataDir: string,
    downloadLocation: string,
    filename: string,
    timeout = 30_000,
): Promise<string> {
    let resolvedPath = path.join(downloadLocation, filename);
    await expect.poll(() => {
        const entry = readDownloadsState(userDataDir)[filename];
        if (entry?.location && fs.existsSync(entry.location)) {
            resolvedPath = entry.location;
            return true;
        }
        return fs.existsSync(path.join(downloadLocation, filename));
    }, {timeout, message: `Downloaded file "${filename}" should exist on disk`}).toBe(true);
    return resolvedPath;
}

export async function closeDownloadTestApp(app: ElectronApplication, userDataDir: string, downloadLocation: string) {
    await app.close().catch(() => {});
    await waitForLockFileRelease(userDataDir).catch(() => {});
    fs.rmSync(downloadLocation, {recursive: true, force: true});
}
