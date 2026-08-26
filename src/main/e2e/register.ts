// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import createTrayMenu from 'app/menus/tray';
import {setBadgeTestRecorder, setUnreadBadgeSetting} from 'app/system/badge';
import Tray from 'app/system/tray/tray';
import TabManager from 'app/tabs/tabManager';
import WebContentsManager from 'app/views/webContentsManager';
import PopoutManager from 'app/windows/popoutManager';
import AppState from 'common/appState';
import {SHOW_SETTINGS_WINDOW} from 'common/communication';
import Config from 'common/config';
import ServerManager from 'common/servers/serverManager';
import ViewManager from 'common/views/viewManager';
import {certificateErrorCallbacks} from 'main/app/app';
import {handleShowSettingsModal} from 'main/app/intercom';
import {openDeepLink} from 'main/app/utils';
import Diagnostics from 'main/diagnostics';
import notificationManager, {flashFrame} from 'main/notifications';
import AllowProtocolDialog from 'main/security/allowProtocolDialog';
import updateNotifier from 'main/updateNotifier';

import {recordBadgeTestState} from './badgeState';
import {registerE2eHooks} from './hooks';
import {
    installMessageBoxStub,
    installOpenDialogStub,
    restoreMessageBoxStub,
    restoreOpenDialogStub,
} from './messageBoxStub';
import {simulateNotificationClick} from './notificationClick';
import {createClickTrayMenuItem} from './trayMenu';

/**
 * Register Playwright globals and test-only IPC handlers.
 * No-op outside NODE_ENV=test.
 */
export function maybeRegisterE2eHooks(): void {
    if (process.env.NODE_ENV !== 'test') {
        return;
    }

    setBadgeTestRecorder(recordBadgeTestState);
    ipcMain.on(SHOW_SETTINGS_WINDOW, handleShowSettingsModal);

    registerE2eHooks({
        e2eTestRefs: {
            AppState,
            MainWindow,
            NotificationManager: notificationManager,
            ServerManager,
            TabManager,
            ViewManager,
            WebContentsManager,
            Config,
            TrayIcon: Tray,
            Diagnostics,
            PopoutManager,
            AllowProtocolDialog,
            updateNotifier,
            setUnreadBadgeSetting,
        },
        openDeepLink,
        clickTrayMenuItem: createClickTrayMenuItem(createTrayMenu),

        // The real gate from main/notifications, not an E2E copy of it, so
        // MM-T1294 / flash_taskbar cannot pass against a stale duplicate.
        triggerNotificationFrameEffects: flashFrame,
        simulateNotificationClick,
        installMessageBoxStub,
        restoreMessageBoxStub,
        installOpenDialogStub,
        restoreOpenDialogStub,
        clearCertificateErrorCallbacks: () => certificateErrorCallbacks.clear(),
    });

    if (process.env.MM_E2E_STUB_MESSAGE_BOX === 'cancel') {
        installMessageBoxStub([{response: 1}]);
    } else if (process.env.MM_E2E_STUB_MESSAGE_BOX === 'trust') {
        installMessageBoxStub([{response: 0}, {response: 0}]);
    }
}
