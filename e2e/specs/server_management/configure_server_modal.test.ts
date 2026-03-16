// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, emptyConfig, writeConfigFile} from '../../helpers/config';
import {waitForAppReady} from '../../helpers/appReadiness';

async function launchWithWelcomeScreen(testInfo: {outputDir: string}) {
    const {mkdirSync} = await import('fs');
    const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
    mkdirSync(userDataDir, {recursive: true});
    writeConfigFile(userDataDir, emptyConfig);
    const {_electron: electron} = await import('playwright');
    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });
    await waitForAppReady(app);

    let configureServerModal = app.windows().find((w) => w.url().includes('welcomeScreen'));
    if (!configureServerModal) {
        configureServerModal = await app.waitForEvent('window', {
            predicate: (w) => w.url().includes('welcomeScreen'),
            timeout: 10000,
        });
    }
    await configureServerModal.click('#getStartedWelcomeScreen');
    await configureServerModal.waitForSelector('#input_name');

    return {app, configureServerModal, userDataDir};
}

test.describe('Configure Server Modal', () => {
    test('MM-T5115 should not be valid if no display name has been set', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, configureServerModal} = await launchWithWelcomeScreen(testInfo);
        try {
            await configureServerModal.type('#input_name', '');
            const connectButtonDisabled = await configureServerModal.getAttribute('#connectConfigureServer', 'disabled');
            expect(connectButtonDisabled === '').toBe(true);
        } finally {
            await app.close();
        }
    });

    test('MM-T5116 should not be valid if no URL has been set', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, configureServerModal} = await launchWithWelcomeScreen(testInfo);
        try {
            await configureServerModal.type('#input_url', '');
            const connectButtonDisabled = await configureServerModal.getAttribute('#connectConfigureServer', 'disabled');
            expect(connectButtonDisabled === '').toBe(true);
        } finally {
            await app.close();
        }
    });

    test('MM-T5117 should be valid if display name and URL are set', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, configureServerModal} = await launchWithWelcomeScreen(testInfo);
        try {
            await configureServerModal.type('#input_name', 'TestServer');
            await configureServerModal.type('#input_url', 'https://community.mattermost.com');
            await configureServerModal.waitForSelector('#customMessage_url.Input___success');
            const connectButtonDisabled = await configureServerModal.getAttribute('#connectConfigureServer', 'disabled');
            expect(connectButtonDisabled === '').toBe(false);
        } finally {
            await app.close();
        }
    });

    test('MM-T5118 should not be valid if an invalid URL has been set', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, configureServerModal} = await launchWithWelcomeScreen(testInfo);
        try {
            await configureServerModal.type('#input_name', 'TestServer');
            await configureServerModal.type('#input_url', '!@#$%^&*()');
            await configureServerModal.waitForSelector('#customMessage_url.Input___error');
            const errorClass = await configureServerModal.getAttribute('#customMessage_url', 'class');
            expect(errorClass).toContain('Input___error');
            const connectButtonDisabled = await configureServerModal.getAttribute('#connectConfigureServer', 'disabled');
            expect(connectButtonDisabled === '').toBe(true);
        } finally {
            await app.close();
        }
    });

    test('MM-T5119 should add the server to the config file', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, configureServerModal, userDataDir} = await launchWithWelcomeScreen(testInfo);
        try {
            await configureServerModal.type('#input_name', 'TestServer');
            await configureServerModal.type('#input_url', 'http://example.org');
            await configureServerModal.click('#connectConfigureServer');
            await configureServerModal.waitForEvent('close').catch(() => {});

            const existing = Boolean(app.windows().find((w) => w.url().includes('welcomeScreen')));
            expect(existing).toBe(false);

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            expect(savedConfig.servers).toContainEqual({
                url: 'http://example.org/',
                name: 'TestServer',
                order: 0,
            });
        } finally {
            await app.close();
        }
    });
});
