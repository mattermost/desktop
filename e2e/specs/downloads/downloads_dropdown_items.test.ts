// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';

const file1 = {
    addedAt: Date.UTC(2022, 7, 8, 10), // Aug 08, 2022 10:00AM UTC
    filename: 'file1.txt',
    mimeType: 'text/plain',
    progress: 100,
    receivedBytes: 3917388,
    state: 'completed',
    totalBytes: 3917388,
    type: 'file',
};
const file2 = {
    addedAt: Date.UTC(2022, 7, 8, 11), // Aug 08, 2022 11:00AM UTC
    filename: 'file2.txt',
    mimeType: 'text/plain',
    progress: 100,
    receivedBytes: 7917388,
    state: 'completed',
    totalBytes: 7917388,
    type: 'file',
};

async function launchAppWithDownloads(userDataDir: string, downloads: Record<string, unknown>) {
    const downloadsLocation = path.join(userDataDir, 'Downloads');
    const configWithDownloadsPath = {
        ...demoConfig,
        downloadsPath: downloadsLocation,
    };

    fs.mkdirSync(userDataDir, {recursive: true});
    fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(configWithDownloadsPath));
    fs.writeFileSync(path.join(userDataDir, 'downloads.json'), JSON.stringify(downloads));

    const {_electron: electron} = await import('playwright');
    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });
    await waitForAppReady(app);
    return {app, downloadsLocation};
}

async function openDownloadsDropdown(app: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>) {
    const mainWindow = app.windows().find((window) => window.url().includes('index')) ??
        await app.waitForEvent('window', {
            predicate: (window) => window.url().includes('index'),
            timeout: 15_000,
        });
    if (!mainWindow) {
        throw new Error('No main window found');
    }
    await mainWindow.waitForLoadState();
    await mainWindow.bringToFront();

    const dlButtonLocator = await mainWindow.waitForSelector('.DownloadsDropdownButton');
    await dlButtonLocator.click();

    let downloadsWindow = app.windows().find((w) => w.url().includes('downloadsDropdown.html'));
    if (!downloadsWindow) {
        downloadsWindow = await app.waitForEvent('window', {
            predicate: (w) => w.url().includes('downloadsDropdown.html'),
            timeout: 10_000,
        });
    }
    await downloadsWindow.waitForLoadState();
    await downloadsWindow.bringToFront();

    // Wait for the React component to fully mount (renders null until appName is resolved via IPC)
    await downloadsWindow.waitForSelector('.DownloadsDropdown', {state: 'visible', timeout: 15_000});
    return downloadsWindow;
}

test.describe('downloads/downloads_dropdown_items', () => {
    test('MM-22239 should display the file correctly (downloaded)', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadsLocation = path.join(userDataDir, 'Downloads');
        const downloads = {
            [file1.filename]: {
                ...file1,
                location: path.join(downloadsLocation, 'file1.txt'),
            },
        };

        // Create the file BEFORE launching the app so checkForDeletedFiles() finds it
        fs.mkdirSync(downloadsLocation, {recursive: true});
        fs.writeFileSync(path.join(downloadsLocation, 'file1.txt'), 'file1 content');
        const {app} = await launchAppWithDownloads(userDataDir, downloads);

        try {
            const downloadsWindow = await openDownloadsDropdown(app);

            const filenameTextLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__Filename');
            const filenameInnerText = await filenameTextLocator.innerText();
            expect(filenameInnerText).toBe(file1.filename);

            const fileStateLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__FileSizeAndStatus');
            const fileStateInnerText = await fileStateLocator.innerText();
            expect(fileStateInnerText).toBe('3.92 MB • Downloaded');

            const fileThumbnailLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__Thumbnail');
            const thumbnailBackgroundImage = await fileThumbnailLocator.evaluate((node) => window.getComputedStyle(node).getPropertyValue('background-image'));
            expect(thumbnailBackgroundImage).toContain('text.svg');
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
            fs.rmSync(downloadsLocation, {recursive: true, force: true});
        }
    });

    test('MM-22239 should display the file correctly (deleted)', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadsLocation = path.join(userDataDir, 'Downloads');
        const downloads = {
            [file1.filename]: {
                ...file1,
                location: path.join(downloadsLocation, 'file1.txt'),
            },
        };

        const {app} = await launchAppWithDownloads(userDataDir, downloads);
        fs.mkdirSync(downloadsLocation, {recursive: true});

        // Do NOT create the file — simulates deleted state

        try {
            const downloadsWindow = await openDownloadsDropdown(app);

            const filenameTextLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__Filename');
            const filenameInnerText = await filenameTextLocator.innerText();
            expect(filenameInnerText).toBe(file1.filename);

            const fileStateLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__FileSizeAndStatus');
            const fileStateInnerText = await fileStateLocator.innerText();
            expect(fileStateInnerText).toBe('3.92 MB • Deleted');

            const fileThumbnailLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__Thumbnail');
            const thumbnailBackgroundImage = await fileThumbnailLocator.evaluate((node) => window.getComputedStyle(node).getPropertyValue('background-image'));
            expect(thumbnailBackgroundImage).toContain('text.svg');
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
            fs.rmSync(downloadsLocation, {recursive: true, force: true});
        }
    });

    test('MM-22239 should display the file correctly (cancelled)', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadsLocation = path.join(userDataDir, 'Downloads');
        const cancelledFile = {
            ...file1,
            location: path.join(downloadsLocation, 'file1.txt'),
            state: 'progressing',
            progress: 50,
            receivedBytes: 1958694,
            totalBytes: 3917388,
        };
        const downloads = {
            [file1.filename]: cancelledFile,
        };

        const {app} = await launchAppWithDownloads(userDataDir, downloads);
        fs.mkdirSync(downloadsLocation, {recursive: true});
        fs.writeFileSync(path.join(downloadsLocation, 'file1.txt'), 'file1 content');

        try {
            const downloadsWindow = await openDownloadsDropdown(app);

            const filenameTextLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__Filename');
            const filenameInnerText = await filenameTextLocator.innerText();
            expect(filenameInnerText).toBe(file1.filename);

            const fileStateLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__FileSizeAndStatus');
            const fileStateInnerText = await fileStateLocator.innerText();
            expect(fileStateInnerText).toBe('3.92 MB • Cancelled');

            const fileThumbnailLocator = await downloadsWindow.waitForSelector('.DownloadsDropdown__Thumbnail');
            const thumbnailBackgroundImage = await fileThumbnailLocator.evaluate((node) => window.getComputedStyle(node).getPropertyValue('background-image'));
            expect(thumbnailBackgroundImage).toContain('text.svg');
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
            fs.rmSync(downloadsLocation, {recursive: true, force: true});
        }
    });

    test('MM-22239 should display the files in correct order', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const downloadsLocation = path.join(userDataDir, 'Downloads');
        const downloads = {
            'file1.txt': {...file1, location: path.join(downloadsLocation, 'file1.txt')},
            'file2.txt': {...file2, location: path.join(downloadsLocation, 'file2.txt')},
        };

        // Create files BEFORE launching so checkForDeletedFiles() finds them as 'completed'
        fs.mkdirSync(downloadsLocation, {recursive: true});
        fs.writeFileSync(path.join(downloadsLocation, 'file1.txt'), 'file1 content');
        fs.writeFileSync(path.join(downloadsLocation, 'file2.txt'), 'file2 content');
        const {app} = await launchAppWithDownloads(userDataDir, downloads);

        try {
            const downloadsWindow = await openDownloadsDropdown(app);

            // Wait for both items to render, then verify order (newest first)
            await downloadsWindow.waitForSelector('.DownloadsDropdown__File__Body__Details__Filename', {timeout: 10_000});
            const filenameTextLocators = downloadsWindow.locator('.DownloadsDropdown__File__Body__Details__Filename');
            expect(await filenameTextLocators.count()).toBe(2);
            const firstItemLocator = filenameTextLocators.first();
            const file1InnerText = await firstItemLocator.innerText();
            expect(file1InnerText).toBe(file2.filename); // newest first
            const secondItemLocator = filenameTextLocators.nth(1);
            const file2InnerText = await secondItemLocator.innerText();
            expect(file2InnerText).toBe(file1.filename);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
            fs.rmSync(downloadsLocation, {recursive: true, force: true});
        }
    });
});
