// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoConfig, type AppConfig} from '../../helpers/config';
import {clickTrayMenuItem, emitTrayIconClick, hideMainWindow, isMainWindowVisible} from '../../helpers/tray';

const trayConfig: AppConfig = {
    ...demoConfig,
    showTrayIcon: true,
    minimizeToTray: true,
};

test.describe('system_tray_icon/hide_to_tray', () => {
    test.use({appConfig: trayConfig});

    test(
        'MM-T6194 main window can be hidden to tray and restored',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Main window should be visible after launch'},
            ).toBe(true);

            await hideMainWindow(electronApp);

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Main window should be hidden after hide()'},
            ).toBe(false);

            await emitTrayIconClick(electronApp);

            // macOS tray click opens the context menu; choosing a server raises the window.
            if (process.platform === 'darwin') {
                await clickTrayMenuItem(electronApp, trayConfig.servers[0].name);
            }

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Main window should be visible after tray restore'},
            ).toBe(true);
        },
    );
});
