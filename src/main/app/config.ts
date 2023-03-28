// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, ipcMain, nativeTheme} from 'electron';
import log, {LogLevel} from 'electron-log';

import {CombinedConfig, Config as ConfigType} from 'types/config';

import {DARK_MODE_CHANGE, EMIT_CONFIGURATION, RELOAD_CONFIGURATION} from 'common/communication';
import Config from 'common/config';

import AutoLauncher from 'main/AutoLauncher';
import {setUnreadBadgeSetting} from 'main/badge';
import {refreshTrayImages} from 'main/tray/tray';
import ViewManager from 'main/views/viewManager';
import WindowManager from 'main/windows/windowManager';

import {handleMainWindowIsShown} from './intercom';
import {handleUpdateMenuEvent, setLoggingLevel, updateSpellCheckerLocales} from './utils';

//
// config event handlers
//

export function handleGetConfiguration() {
    log.debug('Config.handleGetConfiguration');

    return Config.data;
}

export function handleGetLocalConfiguration() {
    log.debug('Config.handleGetLocalConfiguration');

    return {
        ...Config.localData,
        appName: app.name,
        enableServerManagement: Config.enableServerManagement,
        canUpgrade: Config.canUpgrade,
    };
}

export function updateConfiguration(event: Electron.IpcMainEvent, properties: Array<{key: keyof ConfigType; data: ConfigType[keyof ConfigType]}> = []) {
    log.debug('Config.updateConfiguration', properties);

    if (properties.length) {
        const newData = properties.reduce((obj, data) => {
            (obj as any)[data.key] = data.data;
            return obj;
        }, {} as Partial<ConfigType>);
        Config.setMultiple(newData);
    }
}

export function handleUpdateTheme() {
    log.debug('Config.handleUpdateTheme');

    Config.set('darkMode', nativeTheme.shouldUseDarkColors);
}

export function handleConfigUpdate(newConfig: CombinedConfig) {
    if (log.transports.file.level !== newConfig.logLevel) {
        log.error('Log level set to:', newConfig.logLevel);
    }
    if (newConfig.logLevel) {
        setLoggingLevel(newConfig.logLevel as LogLevel);
    }

    log.debug('App.Config.handleConfigUpdate');
    log.silly('App.Config.handleConfigUpdate', newConfig);

    if (!newConfig) {
        return;
    }

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

    handleMainWindowIsShown();

    handleUpdateMenuEvent();
    if (newConfig.trayIconTheme) {
        refreshTrayImages(newConfig.trayIconTheme);
    }

    ipcMain.emit(EMIT_CONFIGURATION, true, newConfig);
}

export function handleDarkModeChange(darkMode: boolean) {
    log.debug('App.Config.handleDarkModeChange', darkMode);

    refreshTrayImages(Config.trayIconTheme);
    WindowManager.sendToRenderer(DARK_MODE_CHANGE, darkMode);
    ViewManager.updateLoadingScreenDarkMode(darkMode);

    ipcMain.emit(EMIT_CONFIGURATION, true, Config.data);
}
