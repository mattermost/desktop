// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, demoConfig, exampleURL, writeConfigFile} from '../../helpers/config';
import {waitForAppReady} from '../../helpers/appReadiness';

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

    const mainView = app.windows().find((w) => w.url().includes('index'))!;
    const dropdownView = app.windows().find((w) => w.url().includes('dropdown'))!;
    await mainView.click('.ServerDropdownButton');
    await dropdownView.hover('.ServerDropdown .ServerDropdown__button:nth-child(1)');
    await dropdownView.click('.ServerDropdown .ServerDropdown__button:nth-child(1) button.ServerDropdown__button-edit');

    const editServerView = await app.waitForEvent('window', {
        predicate: (w) => w.url().includes('editServer'),
    });

    return {app, editServerView, userDataDir};
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
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            expect(savedConfig.servers).toContainEqual({
                name: 'example',
                url: exampleURL,
                order: 0,
            });
        } finally {
            await app.close();
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
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            expect(savedConfig.servers).toContainEqual({
                name: 'example',
                url: exampleURL,
                order: 0,
            });
        } finally {
            await app.close();
        }
    });

    test('MM-T2826_3 should not edit server if an invalid server address has been set', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView} = await launchWithEditServerModal(testInfo);
        try {
            await editServerView.fill('#serverUrlInput', 'superInvalid url');
            await editServerView.waitForSelector('#customMessage_url.Input___error');
            const existing = await editServerView.isVisible('#customMessage_url.Input___error');
            expect(existing).toBe(true);
        } finally {
            await app.close();
        }
    });

    test('MM-T4391_2 should edit server when Save is pressed and name edited', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView, userDataDir} = await launchWithEditServerModal(testInfo);
        try {
            await editServerView.fill('#serverNameInput', 'NewTestServer');
            await editServerView.click('#newServerModal_confirm');
            await editServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('editServer')));
            expect(existing).toBe(false);

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            expect(savedConfig.servers).not.toContainEqual({
                name: 'example',
                url: exampleURL,
                order: 0,
            });
            expect(savedConfig.servers).toContainEqual({
                name: 'NewTestServer',
                url: exampleURL,
                order: 0,
            });
        } finally {
            await app.close();
        }
    });

    test('MM-T4391_3 should edit server when Save is pressed and URL edited', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView, userDataDir} = await launchWithEditServerModal(testInfo);
        try {
            await editServerView.fill('#serverUrlInput', 'http://google.com');
            await editServerView.click('#newServerModal_confirm');
            await editServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('editServer')));
            expect(existing).toBe(false);

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            expect(savedConfig.servers).not.toContainEqual({
                name: 'example',
                url: exampleURL,
                order: 0,
            });
            expect(savedConfig.servers).toContainEqual({
                name: 'example',
                url: 'http://google.com/',
                order: 0,
            });
        } finally {
            await app.close();
        }
    });

    test('MM-T4391_4 should edit server when Save is pressed and both edited', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, editServerView, userDataDir} = await launchWithEditServerModal(testInfo);
        try {
            await editServerView.fill('#serverNameInput', 'NewTestServer');
            await editServerView.fill('#serverUrlInput', 'http://google.com');
            await editServerView.click('#newServerModal_confirm');
            await editServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('editServer')));
            expect(existing).toBe(false);

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            expect(savedConfig.servers).not.toContainEqual({
                name: 'example',
                url: exampleURL,
                order: 0,
            });
            expect(savedConfig.servers).toContainEqual({
                name: 'NewTestServer',
                url: 'http://google.com/',
                order: 0,
            });
        } finally {
            await app.close();
        }
    });
});
