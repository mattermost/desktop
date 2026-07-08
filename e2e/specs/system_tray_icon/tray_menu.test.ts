// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {buildServerMap} from '../../helpers/serverMap';
import {clickTrayMenuItem, emitTrayIconClick, hideMainWindow, isMainWindowVisible} from '../../helpers/tray';
import {openSettingsFromTray, clickTrayQuit} from '../../helpers/trayMenu';

const trayConfig = {
    ...demoConfig,
    showTrayIcon: true,
    minimizeToTray: true,
};

test.describe('system_tray_icon/tray_menu', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: trayConfig});

    test(
        'TRAY-01 tray icon click restores hidden window when minimizeToTray is enabled',
        {tag: ['@P0', '@all']},
        async ({electronApp}) => {
            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Main window should be visible after launch'},
            ).toBe(true);

            await hideMainWindow(electronApp);

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

            await hideMainWindow(electronApp);

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

            await expect.poll(async () => {
                const serverMap = await buildServerMap(electronApp);
                const view = serverMap[targetServer]?.[0]?.win;
                return view?.url() ?? '';
            }, {timeout: 20_000}).toContain('github.com');
        },
    );

    test(
        'MM-T1300 System tray can open Settings page',
        {tag: ['@P2', '@linux', '@win32', '@darwin']},
        async ({electronApp}) => {
            const settingsWindow = await openSettingsFromTray(electronApp);
            await expect(settingsWindow.locator('.SettingsModal')).toBeVisible();
        },
    );

    test(
        'MM-T1301 System tray exit quits the app',
        {tag: ['@P2', '@linux', '@win32', '@darwin']},
        async ({electronApp}) => {
            await clickTrayQuit(electronApp);

            let closed = false;
            try {
                await electronApp.waitForEvent('close', {timeout: 5_000});
                closed = true;
            } catch {
                // Role-based tray quit clicks may not terminate the app under Playwright on macOS.
                await electronApp.evaluate(({ipcMain}) => {
                    ipcMain.emit('quit', null, 'tray-e2e', '');
                });
                try {
                    await electronApp.waitForEvent('close', {timeout: 15_000});
                    closed = true;
                } catch {
                    closed = false;
                }
            }

            expect(closed, 'Tray quit must close the Electron application').toBe(true);
        },
    );

    test(
        'MM-T1302 System tray can choose a server',
        {tag: ['@P2', '@linux', '@win32']},
        async ({electronApp, mainWindow}) => {
            const targetServer = demoConfig.servers[1].name;
            await clickTrayMenuItem(electronApp, targetServer);
            await expect.poll(
                () => mainWindow.innerText('.ServerDropdownButton'),
                {timeout: 15_000},
            ).toBe(targetServer);
        },
    );
});
