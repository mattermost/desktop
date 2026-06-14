// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {buildServerMap} from '../../helpers/serverMap';
import {clickTrayMenuItem, emitTrayIconClick, isMainWindowVisible} from '../../helpers/tray';

const trayConfig = {
    ...demoConfig,
    showTrayIcon: true,
    minimizeToTray: true,
};

async function launchWithTray(testInfo: {outputDir: string}) {
    const {mkdirSync} = await import('fs');
    const userDataDir = path.join(testInfo.outputDir, 'tray-menu-userdata');
    mkdirSync(userDataDir, {recursive: true});
    writeConfigFile(userDataDir, trayConfig);

    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 90_000,
    });
    await waitForAppReady(app);
    return {app, userDataDir};
}

test.describe('system/tray_menu', () => {
    test.describe.configure({mode: 'serial'});

    test(
        'TRAY-01 tray icon click restores hidden window when minimizeToTray is enabled',
        {tag: ['@P0', '@linux', '@win32']},
        async ({}, testInfo) => {
            const {app, userDataDir} = await launchWithTray(testInfo);
            try {
                await expect.poll(
                    () => isMainWindowVisible(app),
                    {timeout: 10_000, message: 'Main window should be visible after launch'},
                ).toBe(true);

                await app.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    refs?.MainWindow?.get?.()?.hide();
                });

                await expect.poll(
                    () => isMainWindowVisible(app),
                    {timeout: 5_000, message: 'Main window should be hidden'},
                ).toBe(false);

                await emitTrayIconClick(app);

                await expect.poll(
                    () => isMainWindowVisible(app),
                    {timeout: 10_000, message: 'Tray icon click should restore the main window'},
                ).toBe(true);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        },
    );

    test(
        'TRAY-02 tray server menu click switches server and raises hidden window',
        {tag: ['@P0', '@linux', '@win32']},
        async ({}, testInfo) => {
            const {app, userDataDir} = await launchWithTray(testInfo);
            try {
                const mainWindow = app.windows().find((window) => window.url().includes('index'));
                expect(mainWindow).toBeDefined();

                await expect.poll(
                    () => mainWindow!.innerText('.ServerDropdownButton'),
                    {timeout: 15_000},
                ).toBe(demoConfig.servers[0].name);

                await app.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    refs?.MainWindow?.get?.()?.hide();
                });

                await expect.poll(
                    () => isMainWindowVisible(app),
                    {timeout: 5_000},
                ).toBe(false);

                const targetServer = demoConfig.servers[1].name;
                await clickTrayMenuItem(app, targetServer);

                await expect.poll(
                    () => isMainWindowVisible(app),
                    {timeout: 10_000, message: 'Tray server menu click should raise the main window'},
                ).toBe(true);

                await expect.poll(
                    () => mainWindow!.innerText('.ServerDropdownButton'),
                    {timeout: 15_000, message: 'Tray server menu click should switch the active server'},
                ).toBe(targetServer);

                const serverMap = await buildServerMap(app);
                await expect.poll(async () => {
                    const view = serverMap[targetServer]?.[0]?.win;
                    return view?.url() ?? '';
                }, {timeout: 20_000}).toContain('github.com');
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        },
    );
});
