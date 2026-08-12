// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';
import {closeElectronAppFast, registerElectronMainProcess, waitForWindow} from '../../helpers/electronApp';

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
        registerElectronMainProcess(app.process()?.pid);

        try {
            await waitForAppReady(app);
            const mainView = await waitForWindow(app, 'index');
            await mainView.click('.ServerDropdownButton');

            // Dropdown / newServer are WebContentsViews. Polling app.windows() avoids
            // the classic waitForEvent race where the window opens before the listener.
            let dropdownView = app.windows().find((w) => {
                try {
                    return w.url().includes('dropdown');
                } catch {
                    return false;
                }
            });
            if (!dropdownView) {
                dropdownView = await waitForWindow(app, 'dropdown');
            }
            await dropdownView.click('.ServerDropdown .ServerDropdown__button.addServer');

            const newServerView = await waitForWindow(app, 'newServer', 20_000);
            await newServerView.waitForSelector('#serverNameInput');

            await newServerView.type('#serverNameInput', longServerName);
            await newServerView.type('#serverUrlInput', longServerUrl);
            await newServerView.click('#newServerModal_confirm');
            await newServerView.waitForEvent('close').catch(() => {});

            await expect.poll(
                () => Boolean(app.windows().find((w) => {
                    try {
                        return w.url().includes('newServer');
                    } catch {
                        return false;
                    }
                })),
                {timeout: 15_000, message: 'New server modal should close after confirm'},
            ).toBe(false);

            const updatedMainView = await waitForWindow(app, 'index');
            const serverNameLocator = updatedMainView.locator(`.ServerDropdownButton span:has-text("${longServerName}")`);
            await expect(serverNameLocator).toBeVisible({timeout: 15_000});

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
            await closeElectronAppFast(app, userDataDir);
        }
    });
});
