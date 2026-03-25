// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';

const file1 = {
    addedAt: Date.UTC(2022, 8, 8, 10), // Sep 08, 2022 10:00AM UTC
    filename: 'file1.txt',
    mimeType: 'plain/text',
    progress: 100,
    receivedBytes: 3917388,
    state: 'completed',
    totalBytes: 3917388,
    type: 'file',
};

function createDownloads(downloadsLocation: string) {
    return {
        [file1.filename]: {
            ...file1,
            location: path.join(downloadsLocation, file1.filename),
        },
    };
}

function createDownloadedFile(downloadsLocation: string) {
    fs.mkdirSync(downloadsLocation, {recursive: true});
    fs.writeFileSync(path.join(downloadsLocation, file1.filename), 'file1 content');
}

async function openDownloadsDropdownWindow(app: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>) {
    let downloadsWindow = app.windows().find((w) => w.url().includes('downloadsDropdown.html'));
    if (!downloadsWindow) {
        downloadsWindow = await app.waitForEvent('window', {
            predicate: (w) => w.url().includes('downloadsDropdown.html'),
            timeout: 10_000,
        });
    }

    await downloadsWindow.waitForLoadState();
    await downloadsWindow.bringToFront();
    await downloadsWindow.waitForSelector('.DownloadsDropdown', {state: 'visible', timeout: 20_000});
    return downloadsWindow;
}

async function launchApp(userDataDir: string, downloadsData: Record<string, unknown>) {
    const downloadsLocation = path.join(userDataDir, 'Downloads');
    const configWithDownloadsPath = {
        ...demoConfig,
        downloadsPath: downloadsLocation,
    };

    fs.mkdirSync(userDataDir, {recursive: true});
    fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(configWithDownloadsPath));
    fs.writeFileSync(path.join(userDataDir, 'downloads.json'), JSON.stringify(downloadsData));

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

test.describe('downloads/downloads_menubar', () => {
    test.describe('The download list is empty', () => {
        test('MM-22239 should not show the downloads dropdown and the menu item should be disabled', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');
            const app = await launchApp(userDataDir, {});

            try {
                const mainWindow = app.windows().find((window) => window.url().includes('index'));
                if (!mainWindow) {
                    throw new Error('No main window found');
                }
                await mainWindow.waitForLoadState();
                await mainWindow.bringToFront();

                const dlButton = mainWindow.locator('.DownloadsDropdownButton');
                expect(await dlButton.isVisible()).toBe(false);

                const saveMenuItem = await app.evaluate(async ({app: electronApp}) => {
                    const viewMenu = (electronApp as any).applicationMenu.getMenuItemById('view');
                    const saveItem = viewMenu.submenu.getMenuItemById('app-menu-downloads');
                    return saveItem;
                });

                expect(saveMenuItem).toHaveProperty('enabled', false);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });
    });

    test.describe('The download list has one file', () => {
        test('MM-22239 should show the downloads dropdown button and the menu item should be enabled', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');
            const downloadsLocation = path.join(userDataDir, 'Downloads');
            createDownloadedFile(downloadsLocation);
            const app = await launchApp(userDataDir, createDownloads(downloadsLocation));

            try {
                const mainWindow = app.windows().find((window) => window.url().includes('index'));
                if (!mainWindow) {
                    throw new Error('No main window found');
                }
                await mainWindow.waitForLoadState();
                await mainWindow.bringToFront();

                const dlButton = await mainWindow.waitForSelector('.DownloadsDropdownButton', {state: 'attached'});
                expect(await dlButton.isVisible()).toBe(true);

                const saveMenuItem = await app.evaluate(async ({app: electronApp}) => {
                    const viewMenu = (electronApp as any).applicationMenu.getMenuItemById('view');
                    const saveItem = viewMenu.submenu.getMenuItemById('app-menu-downloads');
                    return saveItem;
                });

                expect(saveMenuItem).toHaveProperty('enabled', true);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
                fs.rmSync(downloadsLocation, {recursive: true, force: true});
            }
        });

        test('MM-22239 should open the downloads dropdown when clicking the download button in the menubar', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');
            const downloadsLocation = path.join(userDataDir, 'Downloads');
            createDownloadedFile(downloadsLocation);
            const app = await launchApp(userDataDir, createDownloads(downloadsLocation));

            try {
                const mainWindow = app.windows().find((window) => window.url().includes('index'));
                if (!mainWindow) {
                    throw new Error('No main window found');
                }
                await mainWindow.waitForLoadState();
                await mainWindow.bringToFront();

                const dlButton = await mainWindow.waitForSelector('.DownloadsDropdownButton', {state: 'attached'});
                expect(await dlButton.isVisible()).toBe(true);
                await dlButton.click();

                const downloadsWindow = await openDownloadsDropdownWindow(app);
                const isVisible = await downloadsWindow.isVisible('.DownloadsDropdown');
                expect(isVisible).toBe(true);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
                fs.rmSync(downloadsLocation, {recursive: true, force: true});
            }
        });

        test('MM-22239 should open the downloads dropdown from the app menu', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');
            const downloadsLocation = path.join(userDataDir, 'Downloads');
            createDownloadedFile(downloadsLocation);
            const app = await launchApp(userDataDir, createDownloads(downloadsLocation));

            try {
                const mainWindow = app.windows().find((window) => window.url().includes('index'));
                if (!mainWindow) {
                    throw new Error('No main window found');
                }
                await mainWindow.waitForLoadState();
                await mainWindow.bringToFront();

                await app.evaluate(async ({app: electronApp}) => {
                    const viewMenu = (electronApp as any).applicationMenu.getMenuItemById('view');
                    const downloadsItem = viewMenu.submenu.getMenuItemById('app-menu-downloads');
                    downloadsItem.click();
                });

                const downloadsWindow = await openDownloadsDropdownWindow(app);
                const isVisible = await downloadsWindow.isVisible('.DownloadsDropdown');
                expect(isVisible).toBe(true);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
                fs.rmSync(downloadsLocation, {recursive: true, force: true});
            }
        });
    });
});
