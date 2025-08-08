// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, ipcMain, nativeTheme} from 'electron';

import {setUnreadBadgeSetting} from 'app/system/badge';
import Tray from 'app/system/tray/tray';
import {EMIT_CONFIGURATION} from 'common/communication';
import Config from 'common/config';
import {Logger, setLoggingLevel} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import AutoLauncher from 'main/AutoLauncher';

import type {CombinedConfig, Config as ConfigType} from 'types/config';
import type {DeveloperSettings} from 'types/settings';

import {handleMainWindowIsShown} from './intercom';
import {handleUpdateMenuEvent, updateSpellCheckerLocales} from './utils';

const log = new Logger('App.Config');

//
// config event handlers
//

export function handleGetConfiguration() {
    log.debug('handleGetConfiguration');

    return Config.data;
}

export function handleGetLocalConfiguration() {
    log.debug('handleGetLocalConfiguration');

    return {
        ...Config.localData,
        appName: app.name,
        enableServerManagement: Config.enableServerManagement,
        canUpgrade: Config.canUpgrade,
    };
}

export function updateConfiguration(event: Electron.IpcMainEvent, properties: Array<{key: keyof ConfigType; data: ConfigType[keyof ConfigType]}> = []) {
    log.debug('updateConfiguration', properties);

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
    if (newConfig.logLevel) {
        setLoggingLevel(newConfig.logLevel);
    }

    log.debug('handleConfigUpdate');
    log.silly('handleConfigUpdate', newConfig);

    if (!newConfig) {
        return;
    }

    if (app.isReady()) {
        ipcMain.emit(EMIT_CONFIGURATION, true, Config.data);
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

    if (app.isReady()) {
        handleMainWindowIsShown();
    }

    handleUpdateMenuEvent();
    if (newConfig.trayIconTheme) {
        Tray.refreshImages(newConfig.trayIconTheme);
    }

    ipcMain.emit(EMIT_CONFIGURATION, true, newConfig);
}

export function handleDarkModeChange(darkMode: boolean) {
    log.debug('handleDarkModeChange', darkMode);

    Tray.refreshImages(Config.trayIconTheme);
    ipcMain.emit(EMIT_CONFIGURATION, true, Config.data);
}

export function handleDeveloperModeUpdated(json: DeveloperSettings) {
    log.debug('handleDeveloperModeUpdated', json);

    if (['browserOnly', 'disableContextMenu'].some((key) => Object.hasOwn(json, key))) {
        ServerManager.init();
    }
}
