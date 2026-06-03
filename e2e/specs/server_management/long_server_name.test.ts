// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';

test.describe('LongServerName', () => {
    test('MM-T4050 Long server name', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        const longServerName = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus quis malesuada dolor, vel scelerisque sem';
        const longServerUrl = 'https://example.org';

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
            const mainView = app.windows().find((w) => w.url().includes('index'))!;
            await mainView.waitForLoadState('domcontentloaded');
            await mainView.click('.ServerDropdownButton');

            const dropdownView = app.windows().find((w) => w.url().includes('dropdown'))!;
            await dropdownView.waitForLoadState('domcontentloaded');
            await dropdownView.click('.ServerDropdown .ServerDropdown__button.addServer');
            const newServerView = await app.waitForEvent('window', {
                predicate: (w) => w.url().includes('newServer'),
                timeout: 10000,
            });

            await newServerView.type('#serverNameInput', longServerName);
            await newServerView.type('#serverUrlInput', longServerUrl);
            await newServerView.click('#newServerModal_confirm');
            await newServerView.waitForEvent('close').catch(() => {});

            const existing = Boolean(app.windows().find((w) => w.url().includes('newServer')));
            expect(existing).toBe(false);

            const updatedMainView = app.windows().find((w) => w.url().includes('index'))!;

            const serverNameLocator = updatedMainView.locator(`.ServerDropdownButton span:has-text("${longServerName}")`);

            const isTruncated = await serverNameLocator.evaluate((element) => {
                return (element as HTMLElement).offsetWidth < (element as HTMLElement).scrollWidth;
            });
            expect(isTruncated).toBe(true);

            const isWithinMaxWidth = await serverNameLocator.evaluate((element) => {
                const width = parseFloat(window.getComputedStyle(element).getPropertyValue('width'));
                return width <= 400;
            });
            expect(isWithinMaxWidth).toBe(true);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    });
});
