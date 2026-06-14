// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {buildServerMap} from '../../helpers/serverMap';

test.describe('mattermost/window_close', () => {
    test(
        'MM-67909 window.close() in a server view does not crash the app',
        {tag: ['@P1', '@all']},
        async ({}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');
            fs.mkdirSync(userDataDir, {recursive: true});
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
                const serverMap = await buildServerMap(app);
                const serverName = demoConfig.servers[0].name;
                const serverView = serverMap[serverName]?.[0]?.win;
                expect(serverView).toBeDefined();

                await serverView!.evaluate(() => {
                    window.close();
                });

                const mainWindow = app.windows().find((window) => window.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await expect.poll(
                    () => mainWindow!.evaluate(() => document.readyState === 'complete'),
                    {timeout: 10_000},
                ).toBe(true);

                const refreshedMap = await buildServerMap(app);
                expect(refreshedMap[serverName]?.length ?? 0).toBeGreaterThan(0);
            } finally {
                await app.close().catch(() => {});
                await waitForLockFileRelease(userDataDir);
            }
        },
    );

    test(
        'MM-67909 app can be blurred and refocused after window.close() in a server view',
        {tag: ['@P1', '@all']},
        async ({}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'userdata');
            fs.mkdirSync(userDataDir, {recursive: true});
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
                const serverMap = await buildServerMap(app);
                const serverName = demoConfig.servers[0].name;
                const serverView = serverMap[serverName]?.[0]?.win;
                expect(serverView).toBeDefined();

                await serverView!.evaluate(() => {
                    window.close();
                });

                const mainWindow = app.windows().find((window) => window.url().includes('index'));
                expect(mainWindow).toBeDefined();
                const browserWindow = await app.browserWindow(mainWindow!);
                await browserWindow.evaluate((win) => win.blur());
                await browserWindow.evaluate((win) => win.focus());

                await expect.poll(
                    () => mainWindow!.evaluate(() => document.readyState === 'complete'),
                    {timeout: 10_000},
                ).toBe(true);

                const refreshedMap = await buildServerMap(app);
                expect(refreshedMap[serverName]?.length ?? 0).toBeGreaterThan(0);
            } finally {
                await app.close().catch(() => {});
                await waitForLockFileRelease(userDataDir);
            }
        },
    );
});
