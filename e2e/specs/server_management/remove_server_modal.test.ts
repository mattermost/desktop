// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';

async function launchWithRemoveServerModal(testInfo: {outputDir: string}) {
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
    let dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
    if (!dropdownView) {
        dropdownView = await app.waitForEvent('window', {
            predicate: (w) => w.url().includes('dropdown'),
            timeout: 10000,
        });
    }

    await mainView.click('.ServerDropdownButton');
    await dropdownView.hover('.ServerDropdown .ServerDropdown__button:nth-child(1)');
    await dropdownView.click('.ServerDropdown .ServerDropdown__button:nth-child(1) button.ServerDropdown__button-remove');

    const removeServerView = await app.waitForEvent('window', {
        predicate: (w) => w.url().includes('removeServer'),
    });

    return {app, removeServerView, userDataDir};
}

test.describe('RemoveServerModal', () => {
    test('MM-T4390_1 should remove existing server on click Remove', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, removeServerView, userDataDir} = await launchWithRemoveServerModal(testInfo);
        try {
            await removeServerView.click('button:has-text("Remove")');
            await removeServerView.waitForEvent('close').catch(() => {});

            const expectedConfig = JSON.parse(JSON.stringify(demoConfig.servers.slice(1)));
            expectedConfig.forEach((value: {order: number}) => {
                value.order--;
            });

            const configPath = path.join(userDataDir, 'config.json');
            await expect.poll(() => {
                const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return savedConfig.servers;
            }, {timeout: 10000}).toEqual(expect.arrayContaining(
                expectedConfig.map((s: {name: string; url: string; order: number}) => expect.objectContaining(s)),
            ));
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test('MM-T4390_2 should NOT remove existing server on click Cancel', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, removeServerView, userDataDir} = await launchWithRemoveServerModal(testInfo);
        try {
            await removeServerView.click('button:has-text("Cancel")');
            await removeServerView.waitForEvent('close').catch(() => {});

            const configPath = path.join(userDataDir, 'config.json');
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            expect(savedConfig.servers).toEqual(expect.arrayContaining(
                demoConfig.servers.map((s) => expect.objectContaining(s)),
            ));
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test('MM-T4390_3 should disappear on click Close', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, removeServerView, userDataDir} = await launchWithRemoveServerModal(testInfo);
        try {
            await removeServerView.click('button.close');
            await removeServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('removeServer')));
            expect(existing).toBe(false);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });

    test('MM-T4390_4 should disappear on click background', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const {app, removeServerView, userDataDir} = await launchWithRemoveServerModal(testInfo);
        try {
            try {
                await removeServerView.click('.Modal', {position: {x: 20, y: 20}});
            } catch {} // eslint-disable-line no-empty
            await removeServerView.waitForEvent('close').catch(() => {});
            const existing = Boolean(app.windows().find((w) => w.url().includes('removeServer')));
            expect(existing).toBe(false);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });
});
