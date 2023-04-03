// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, ipcMain} from 'electron';

import {CombinedConfig} from 'types/config';

import {DARK_MODE_CHANGE, EMIT_CONFIGURATION, RELOAD_CONFIGURATION} from 'common/communication';
import Config from 'common/config';
import logger from 'common/log';

import AutoLauncher from 'main/AutoLauncher';
import {setUnreadBadgeSetting} from 'main/badge';
import {refreshTrayImages} from 'main/tray/tray';
import WindowManager from 'main/windows/windowManager';

import {handleMainWindowIsShown} from './intercom';
import {handleUpdateMenuEvent, updateServerInfos, updateSpellCheckerLocales} from './utils';

const log = logger.withPrefix('App.Config');

//
// config event handlers
//

export function handleConfigUpdate(newConfig: CombinedConfig) {
    if (newConfig.logLevel) {
        logger.setLoggingLevel(newConfig.logLevel);
    }

    log.debug('handleConfigUpdate');
    log.silly('handleConfigUpdate', newConfig);

    if (!newConfig) {
        return;
    }

    WindowManager.handleUpdateConfig();
    if (app.isReady()) {
        WindowManager.sendToRenderer(RELOAD_CONFIGURATION);
    }

    setUnreadBadgeSetting(newConfig && newConfig.showUnreadBadge);
    updateSpellCheckerLocales();

    if (newConfig.downloadLocation) {
        try {
            app.setPath('downloads', newConfig.downloadLocation);
        } catch (e) {
            log.error(`There was a problem trying to set the default download path: ${e}`);
        }
    }

    if (process.platform === 'win32' || process.platform === 'linux') {
        const autoStartTask = newConfig.autostart ? AutoLauncher.enable() : AutoLauncher.disable();
        autoStartTask.then(() => {
            log.info('config.autostart has been configured:', newConfig.autostart);
        }).catch((err) => {
            log.error('error:', err);
        });
    }

    updateServerInfos(newConfig.teams);
    WindowManager.initializeCurrentServerName();
    handleMainWindowIsShown();

    handleUpdateMenuEvent();
    if (newConfig.trayIconTheme) {
        refreshTrayImages(newConfig.trayIconTheme);
    }

    ipcMain.emit(EMIT_CONFIGURATION, true, newConfig);
}

export function handleDarkModeChange(darkMode: boolean) {
    log.debug('handleDarkModeChange', darkMode);

    refreshTrayImages(Config.trayIconTheme);
    WindowManager.sendToRenderer(DARK_MODE_CHANGE, darkMode);
    WindowManager.updateLoadingScreenDarkMode(darkMode);

    ipcMain.emit(EMIT_CONFIGURATION, true, Config.data);
}
