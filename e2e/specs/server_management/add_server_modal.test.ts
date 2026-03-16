// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';

test.describe('Add Server Modal', () => {
    test('MM-T1312 should focus the first text input', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
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
        try {
            await waitForAppReady(app);
            const mainView = app.windows().find((w) => w.url().includes('index'));
            const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
            await mainView!.click('.ServerDropdownButton');
            await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
            const newServerView = await app.waitForEvent('window', {
                predicate: (w) => w.url().includes('newServer'),
            });
            const isFocused = await newServerView.$eval('#serverUrlInput', (el) => el.isSameNode(document.activeElement));
            expect(isFocused).toBe(true);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test('MM-T4388 should close the window after clicking cancel', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
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
        try {
            await waitForAppReady(app);
            const mainView = app.windows().find((w) => w.url().includes('index'));
            const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
            await mainView!.click('.ServerDropdownButton');
            await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
            const newServerView = await app.waitForEvent('window', {
                predicate: (w) => w.url().includes('newServer'),
            });
            await newServerView.click('#newServerModal_cancel');
            await newServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('newServer')));
            expect(existing).toBe(false);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test.describe('MM-T4389 Invalid messages', () => {
        test('MM-T4389_1 should not be valid and save should be disabled if no server name or URL has been set', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
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
            try {
                await waitForAppReady(app);
                const mainView = app.windows().find((w) => w.url().includes('index'));
                const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
                await mainView!.click('.ServerDropdownButton');
                await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
                const newServerView = await app.waitForEvent('window', {
                    predicate: (w) => w.url().includes('newServer'),
                });
                const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
                expect(disabled === '').toBe(true);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('should warn the user if a server with the same URL exists, but still allow them to save', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
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
            try {
                await waitForAppReady(app);
                const mainView = app.windows().find((w) => w.url().includes('index'));
                const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
                await mainView!.click('.ServerDropdownButton');
                await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
                const newServerView = await app.waitForEvent('window', {
                    predicate: (w) => w.url().includes('newServer'),
                });
                await newServerView.type('#serverNameInput', 'some-new-server');
                await newServerView.type('#serverUrlInput', demoConfig.servers[0].url);
                await newServerView.waitForSelector('#customMessage_url.Input___warning');
                const existing = await newServerView.isVisible('#customMessage_url.Input___warning');
                expect(existing).toBe(true);
                const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
                expect(disabled === '').toBe(false);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test.describe('Valid server name', () => {
            test('MM-T4389_2 Name should not be marked invalid, but should not be able to save', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
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
                try {
                    await waitForAppReady(app);
                    const mainView = app.windows().find((w) => w.url().includes('index'));
                    const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
                    await mainView!.click('.ServerDropdownButton');
                    await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
                    const newServerView = await app.waitForEvent('window', {
                        predicate: (w) => w.url().includes('newServer'),
                    });
                    await newServerView.type('#serverNameInput', 'TestServer');
                    await newServerView.waitForSelector('#customMessage_name.Input___error', {state: 'detached'});
                    const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
                    expect(disabled === '').toBe(true);
                } finally {
                    await app.close();
                    await waitForLockFileRelease(userDataDir);
                }
            });
        });

        test.describe('Valid server url', () => {
            test('MM-T4389_3 URL should not be marked invalid, name should be marked invalid', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
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
                try {
                    await waitForAppReady(app);
                    const mainView = app.windows().find((w) => w.url().includes('index'));
                    const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
                    await mainView!.click('.ServerDropdownButton');
                    await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
                    const newServerView = await app.waitForEvent('window', {
                        predicate: (w) => w.url().includes('newServer'),
                    });
                    await newServerView.type('#serverUrlInput', 'http://example.org');
                    await newServerView.waitForSelector('#customMessage_name.Input___error');
                    const existingUrl = await newServerView.isVisible('#customMessage_url.Input___error');
                    const existingName = await newServerView.isVisible('#customMessage_name.Input___error');
                    const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
                    expect(existingName).toBe(true);
                    expect(existingUrl).toBe(false);
                    expect(disabled === '').toBe(true);
                } finally {
                    await app.close();
                    await waitForLockFileRelease(userDataDir);
                }
            });
        });
    });

    test('MM-T2826_1 should not be valid if an invalid server address has been set', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
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
        try {
            await waitForAppReady(app);
            const mainView = app.windows().find((w) => w.url().includes('index'));
            const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
            await mainView!.click('.ServerDropdownButton');
            await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
            const newServerView = await app.waitForEvent('window', {
                predicate: (w) => w.url().includes('newServer'),
            });
            await newServerView.type('#serverUrlInput', 'superInvalid url');
            await newServerView.waitForSelector('#customMessage_url.Input___error');
            const existing = await newServerView.isVisible('#customMessage_url.Input___error');
            expect(existing).toBe(true);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test.describe('Valid Team Settings', () => {
        test('should be possible to click add', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
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
            try {
                await waitForAppReady(app);
                const mainView = app.windows().find((w) => w.url().includes('index'));
                const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
                await mainView!.click('.ServerDropdownButton');
                await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
                const newServerView = await app.waitForEvent('window', {
                    predicate: (w) => w.url().includes('newServer'),
                });
                await newServerView.type('#serverUrlInput', 'http://example.org');
                await newServerView.type('#serverNameInput', 'TestServer');
                await newServerView.waitForSelector('#customMessage_url.Input___warning');
                const disabled = await newServerView.getAttribute('#newServerModal_confirm', 'disabled');
                expect(disabled === null).toBe(true);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('MM-T2826_2 should add the server to the config file', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
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
            try {
                await waitForAppReady(app);
                const mainView = app.windows().find((w) => w.url().includes('index'));
                const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
                await mainView!.click('.ServerDropdownButton');
                await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
                const newServerView = await app.waitForEvent('window', {
                    predicate: (w) => w.url().includes('newServer'),
                });
                await newServerView.type('#serverUrlInput', 'http://example.org');
                await newServerView.type('#serverNameInput', 'TestServer');
                await newServerView.waitForSelector('#customMessage_url.Input___warning');
                await newServerView.click('#newServerModal_confirm');
                await newServerView.waitForEvent('close').catch(() => {});
                const existing = Boolean(app.windows().find((w) => w.url().includes('newServer')));
                expect(existing).toBe(false);

                const configPath = path.join(userDataDir, 'config.json');
                const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                expect(savedConfig.servers).toContainEqual(expect.objectContaining({
                    name: 'TestServer',
                    url: 'http://example.org/',
                    order: 2,
                }));
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });
    });
});
