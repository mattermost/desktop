// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {buildServerMap} from '../../helpers/serverMap';
import {clickTrayMenuItem, emitTrayIconClick, isMainWindowVisible} from '../../helpers/tray';

const trayConfig = {
    ...demoConfig,
    showTrayIcon: true,
    minimizeToTray: true,
};

test.describe('system/tray_menu', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: trayConfig});

    test(
        'TRAY-01 tray icon click restores hidden window when minimizeToTray is enabled',
        {tag: ['@P0', '@linux', '@win32']},
        async ({electronApp}) => {
            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Main window should be visible after launch'},
            ).toBe(true);

            await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                refs?.MainWindow?.get?.()?.hide();
            });

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 5_000, message: 'Main window should be hidden'},
            ).toBe(false);

            await emitTrayIconClick(electronApp);

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Tray icon click should restore the main window'},
            ).toBe(true);
        },
    );

    test(
        'TRAY-02 tray server menu click switches server and raises hidden window',
        {tag: ['@P0', '@linux', '@win32']},
        async ({electronApp, mainWindow}) => {
            await expect.poll(
                () => mainWindow.innerText('.ServerDropdownButton'),
                {timeout: 15_000},
            ).toBe(demoConfig.servers[0].name);

            await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                refs?.MainWindow?.get?.()?.hide();
            });

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 5_000},
            ).toBe(false);

            const targetServer = demoConfig.servers[1].name;
            await clickTrayMenuItem(electronApp, targetServer);

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Tray server menu click should raise the main window'},
            ).toBe(true);

            await expect.poll(
                () => mainWindow.innerText('.ServerDropdownButton'),
                {timeout: 15_000, message: 'Tray server menu click should switch the active server'},
            ).toBe(targetServer);

            const serverMap = await buildServerMap(electronApp);
            await expect.poll(async () => {
                const view = serverMap[targetServer]?.[0]?.win;
                return view?.url() ?? '';
            }, {timeout: 20_000}).toContain('github.com');
        },
    );
});
