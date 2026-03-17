// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, exampleURL, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';

function readJsonFile<T>(filePath: string): T | undefined {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
        return undefined;
    }
}

async function waitForWindow(app: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>, pattern: string, timeout = 30_000) {
    const timeoutAt = Date.now() + timeout;
    while (Date.now() < timeoutAt) {
        const win = app.windows().find((w) => {
            try {
                return w.url().includes(pattern);
            } catch {
                return false;
            }
        });

        if (win) {
            await win.waitForLoadState().catch(() => {});
            return win;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out waiting for window matching "${pattern}". Available: ${app.windows().map((w) => w.url()).join(', ')}`);
}

async function launchWithEditServerModal(testInfo: {outputDir: string}) {
    const {mkdirSync} = await import('fs');
    const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
    mkdirSync(userDataDir, {recursive: true});
    writeConfigFile(userDataDir, demoConfig);
    const {_electron: electron} = await import('playwright');
    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });
    await waitForAppReady(app);

    const mainView = await waitForWindow(app, 'index');
    let dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
    await mainView.click('.ServerDropdownButton');
    if (!dropdownView) {
        dropdownView = await waitForWindow(app, 'dropdown');
    }
    await dropdownView.hover('.ServerDropdown .ServerDropdown__button:nth-child(1)');
    await dropdownView.click('.ServerDropdown .ServerDropdown__button:nth-child(1) button.ServerDropdown__button-edit');

    const editServerView = await waitForWindow(app, 'editServer');

    return {app, editServerView, userDataDir};
}

async function waitForEditServerModalReady(editServerView: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>> extends never ? never : any) {
    await editServerView.waitForSelector('#serverNameInput');
    await editServerView.waitForFunction(() => {
        const confirmButton = document.querySelector<HTMLButtonElement>('#newServerModal_confirm');
        return Boolean(confirmButton) && !confirmButton.disabled;
    });
}

async function waitForEditServerValues(editServerView: any, expected: {name?: string; url?: string}) {
    await editServerView.waitForFunction(({name, url}: {name?: string; url?: string}) => {
        const nameInput = document.querySelector<HTMLInputElement>('#serverNameInput');
        const urlInput = document.querySelector<HTMLInputElement>('#serverUrlInput');
        const confirmButton = document.querySelector<HTMLButtonElement>('#newServerModal_confirm');
        const normalize = (value?: string) => value?.replace(/\/$/, '');

        const nameMatches = typeof name === 'undefined' || nameInput?.value === name;
        const urlMatches = typeof url === 'undefined' || normalize(urlInput?.value) === normalize(url);
        const confirmEnabled = Boolean(confirmButton) && !confirmButton.disabled;

        return nameMatches && urlMatches && confirmEnabled;
    }, expected);
}

async function waitForConfigServers(configPath: string) {
    await expect.poll(() => readJsonFile<{servers: Array<{name: string; url: string; order: number}>}>(configPath)?.servers, {
        timeout: 10_000,
    }).toBeDefined();

    return readJsonFile<{servers: Array<{name: string; url: string; order: number}>}>(configPath)!;
}

test.describe('EditServerModal', () => {
    test('should not edit server when Cancel is pressed', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView, userDataDir} = await launchWithEditServerModal(testInfo);
        try {
            await editServerView.click('#newServerModal_cancel');
            await editServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('editServer')));
            expect(existing).toBe(false);

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = await waitForConfigServers(configPath);
            expect(savedConfig.servers).toContainEqual(expect.objectContaining({
                name: 'example',
                url: exampleURL,
                order: 0,
            }));
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test('MM-T4391_1 should not edit server when Save is pressed but nothing edited', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView, userDataDir} = await launchWithEditServerModal(testInfo);
        try {
            await editServerView.click('#newServerModal_confirm');
            await editServerView.waitForEvent('close').catch(() => {});

            const existing = Boolean(app.windows().find((w) => w.url().includes('editServer')));
            expect(existing).toBe(false);

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = await waitForConfigServers(configPath);
            expect(savedConfig.servers).toContainEqual(expect.objectContaining({
                name: 'example',
                url: exampleURL,
                order: 0,
            }));
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test('MM-T2826_3 should not edit server if an invalid server address has been set', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView, userDataDir} = await launchWithEditServerModal(testInfo);
        try {
            await editServerView.fill('#serverUrlInput', 'superInvalid url');
            await editServerView.waitForSelector('#customMessage_url.Input___error');
            const existing = await editServerView.isVisible('#customMessage_url.Input___error');
            expect(existing).toBe(true);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test('MM-T4391_2 should edit server when Save is pressed and name edited', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView, userDataDir} = await launchWithEditServerModal(testInfo);
        try {
            await waitForEditServerModalReady(editServerView);
            await editServerView.fill('#serverNameInput', 'NewTestServer');
            await waitForEditServerValues(editServerView, {name: 'NewTestServer'});
            await editServerView.click('#newServerModal_confirm');
            await editServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('editServer')));
            expect(existing).toBe(false);

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = await waitForConfigServers(configPath);
            expect(savedConfig.servers).not.toContainEqual(expect.objectContaining({
                name: 'example',
                url: exampleURL,
                order: 0,
            }));
            expect(savedConfig.servers).toContainEqual(expect.objectContaining({
                name: 'NewTestServer',
                url: exampleURL,
                order: 0,
            }));
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test('MM-T4391_3 should edit server when Save is pressed and URL edited', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView, userDataDir} = await launchWithEditServerModal(testInfo);
        try {
            await waitForEditServerModalReady(editServerView);
            await editServerView.fill('#serverUrlInput', 'http://google.com');
            await waitForEditServerValues(editServerView, {url: 'http://google.com'});
            await editServerView.click('#newServerModal_confirm');
            await editServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('editServer')));
            expect(existing).toBe(false);

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = await waitForConfigServers(configPath);
            expect(savedConfig.servers).not.toContainEqual(expect.objectContaining({
                name: 'example',
                url: exampleURL,
                order: 0,
            }));
            expect(savedConfig.servers).toContainEqual(expect.objectContaining({
                name: 'example',
                url: 'http://google.com/',
                order: 0,
            }));
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test('MM-T4391_4 should edit server when Save is pressed and both edited', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView, userDataDir} = await launchWithEditServerModal(testInfo);
        try {
            await waitForEditServerModalReady(editServerView);
            await editServerView.fill('#serverNameInput', 'NewTestServer');
            await editServerView.fill('#serverUrlInput', 'http://google.com');
            await waitForEditServerValues(editServerView, {name: 'NewTestServer', url: 'http://google.com'});
            await editServerView.click('#newServerModal_confirm');
            await editServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('editServer')));
            expect(existing).toBe(false);

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = await waitForConfigServers(configPath);
            expect(savedConfig.servers).not.toContainEqual(expect.objectContaining({
                name: 'example',
                url: exampleURL,
                order: 0,
            }));
            expect(savedConfig.servers).toContainEqual(expect.objectContaining({
                name: 'NewTestServer',
                url: 'http://google.com/',
                order: 0,
            }));
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });
});
