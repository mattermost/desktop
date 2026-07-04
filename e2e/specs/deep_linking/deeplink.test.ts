// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig} from '../../helpers/config';
import {waitForServerUrlAndDropdown} from '../../helpers/deeplink';
import {closeElectronAppFast, registerElectronMainProcess} from '../../helpers/electronApp';
import {buildServerMap} from '../../helpers/serverMap';

test.describe('application', () => {
    let app: ElectronApplication | undefined;
    let userDataDir: string;

    test.beforeAll(async ({}, testInfo) => {
        userDataDir = path.join(testInfo.outputDir, 'userdata');
        fs.mkdirSync(userDataDir, {recursive: true});
        fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(demoConfig));

        const {_electron: electron} = await import('playwright');

        // When running via the unpacked Electron binary (not a packaged app),
        // electron-is-dev resolves isDev=true, so getDeeplinkingURL() expects
        // the 'mattermost-dev://' protocol prefix rather than 'mattermost://'.
        app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu', 'mattermost-dev://github.com/test/url'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

        registerElectronMainProcess(app.process()?.pid);
    });

    test.afterAll(async () => {
        if (app && userDataDir) {
            await closeElectronAppFast(app, userDataDir);
        }
    });

    test('MM-T1304/MM-T1306 should open the app on the requested deep link', {tag: ['@P2', '@win32']}, async () => {
        await waitForAppReady(app!);

        const mainWindow = app!.windows().find((window) => window.url().includes('index'));
        if (!mainWindow) {
            throw new Error('No main window found');
        }

        // Wait for server map to have the github server populated before polling its URL,
        // for a clearer failure message if the server never registers at all.
        const serverName = demoConfig.servers[1].name;
        await expect.poll(async () => {
            const resolvedServerMap = await buildServerMap(app!);
            return resolvedServerMap[serverName]?.length ?? 0;
        }, {timeout: 15_000}).toBeGreaterThanOrEqual(1);

        // Poll the server view's URL directly via webContents.fromId() instead
        // of navigating contentView.children. On newer Electron versions the
        // WebContentsView tree layout differs between platforms, but
        // webContents.fromId() works universally.
        await waitForServerUrlAndDropdown(app!, mainWindow, serverName, 'github.com/test/url');
    });
});

test.describe('macOS open-url deep link', () => {
    test.use({appConfig: demoConfig});

    test(
        'DL-02 macOS open-url event navigates to deep link while app is running',
        {tag: ['@P1', '@darwin']},
        async ({electronApp, mainWindow}) => {
            await electronApp.evaluate(({app: electronApp}) => {
                electronApp.emit('open-url', {preventDefault: () => undefined}, 'mattermost-dev://github.com/test/url');
            });

            const serverName = demoConfig.servers[1].name;
            await waitForServerUrlAndDropdown(electronApp, mainWindow, serverName, 'github.com/test/url');
        },
    );
});
