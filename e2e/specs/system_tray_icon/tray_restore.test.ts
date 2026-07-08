// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {emitTrayIconClick, hideMainWindow, isMainWindowVisible} from '../../helpers/tray';

const trayConfig = {
    ...demoConfig,
    showTrayIcon: true,
    minimizeToTray: true,
};

test.describe('system_tray_icon/tray_restore', () => {
    test.use({appConfig: trayConfig});

    test(
        'MM-T6194 main window can be hidden to tray and restored',
        {tag: ['@P0', '@all']},
        async ({electronApp}) => {
            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Main window should be visible after launch'},
            ).toBe(true);

            await hideMainWindow(electronApp);

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 5_000, message: 'Main window should be hidden after hide()'},
            ).toBe(false);

            await emitTrayIconClick(electronApp);

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Tray icon click should restore the main window'},
            ).toBe(true);
        },
    );
});
