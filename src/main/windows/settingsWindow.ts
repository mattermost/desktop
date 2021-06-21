// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow} from 'electron';
import log from 'electron-log';
import {CombinedConfig} from 'types/config';

import ContextMenu from '../contextMenu';
import {getLocalPreload, getLocalURLString} from '../utils';

export function createSettingsWindow(mainWindow: BrowserWindow, config: CombinedConfig, withDevTools: boolean) {
    const preload = getLocalPreload('mainWindow.js');
    const spellcheck = (typeof config.useSpellChecker === 'undefined' ? true : config.useSpellChecker);
    const settingsWindow = new BrowserWindow({
        parent: mainWindow,
        title: 'Desktop App Settings',
        fullscreen: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload,
            spellcheck,
            enableRemoteModule: process.env.NODE_ENV === 'test',
        }});

    const contextMenu = new ContextMenu({}, settingsWindow);
    contextMenu.reload();

    const localURL = getLocalURLString('settings.html');
    settingsWindow.setMenuBarVisibility(false);
    settingsWindow.loadURL(localURL).catch(
        (reason) => {
            log.error(`Settings window failed to load: ${reason}`);
            log.info(process.env);
        });
    settingsWindow.show();

    if (withDevTools) {
        settingsWindow.webContents.openDevTools({mode: 'detach'});
    }
    return settingsWindow;
}
