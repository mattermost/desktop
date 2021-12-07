// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, ipcMain} from 'electron';
import log from 'electron-log';

import {CombinedConfig} from 'types/config';

import {DARK_MODE_CHANGE, EMIT_CONFIGURATION, RELOAD_CONFIGURATION} from 'common/communication';
import Config from 'common/config';

import AutoLauncher from 'main/AutoLauncher';
import {setUnreadBadgeSetting} from 'main/badge';
import {refreshTrayImages} from 'main/tray/tray';
import WindowManager from 'main/windows/windowManager';

import {handleNewServerModal} from './intercom';
import {handleUpdateMenuEvent, updateServerInfos, updateSpellCheckerLocales} from './utils';

let didCheckForAddServerModal = false;

//
// config event handlers
//

export function handleConfigUpdate(newConfig: CombinedConfig) {
    if (!newConfig) {
        return;
    }
    if (process.platform === 'win32' || process.platform === 'linux') {
        const autoStartTask = Config.autostart ? AutoLauncher.enable() : AutoLauncher.disable();
        autoStartTask.then(() => {
            log.info('config.autostart has been configured:', newConfig.autostart);
        }).catch((err) => {
            log.error('error:', err);
        });
        WindowManager.handleUpdateConfig();
        setUnreadBadgeSetting(newConfig && newConfig.showUnreadBadge);
        updateSpellCheckerLocales();
    }

    handleUpdateMenuEvent();
    ipcMain.emit(EMIT_CONFIGURATION, true, newConfig);
}

export function handleConfigSynchronize() {
    if (!Config.data) {
        return;
    }

    // TODO: send this to server manager
    WindowManager.handleUpdateConfig();
    setUnreadBadgeSetting(Config.data.showUnreadBadge);
    if (Config.data.downloadLocation) {
        try {
            app.setPath('downloads', Config.data.downloadLocation);
        } catch (e) {
            log.error(`There was a problem trying to set the default download path: ${e}`);
        }
    }
    if (app.isReady()) {
        WindowManager.sendToRenderer(RELOAD_CONFIGURATION);
    }

    if (process.platform === 'win32' && !didCheckForAddServerModal && typeof Config.registryConfigData !== 'undefined') {
        didCheckForAddServerModal = true;
        updateServerInfos(Config.teams);
        WindowManager.initializeCurrentServerName();
        if (Config.teams.length === 0) {
            handleNewServerModal();
        }
    }
}

export function handleDarkModeChange(darkMode: boolean) {
    refreshTrayImages(Config.trayIconTheme);
    WindowManager.sendToRenderer(DARK_MODE_CHANGE, darkMode);
    WindowManager.updateLoadingScreenDarkMode(darkMode);

    ipcMain.emit(EMIT_CONFIGURATION, true, Config.data);
}
