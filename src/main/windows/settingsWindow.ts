// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow} from 'electron';
import log from 'electron-log';

import Config from 'common/config';

import ContextMenu from '../contextMenu';
import {getLocalPreload, getLocalURLString} from '../utils';

export function createSettingsWindow(mainWindow: BrowserWindow, withDevTools: boolean) {
    const preload = getLocalPreload('desktopAPI.js');
    const spellcheck = (typeof Config.useSpellChecker === 'undefined' ? true : Config.useSpellChecker);
    const settingsWindow = new BrowserWindow({
        parent: mainWindow,
        title: 'Desktop App Settings',
        fullscreen: false,
        webPreferences: {
            preload,
            spellcheck,
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
