// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, ipcMain} from 'electron';

import {SHOW_SETTINGS_WINDOW} from 'common/communication';
import Config from 'common/config';
import log from 'common/log';

import ContextMenu from '../contextMenu';
import {getLocalPreload, getLocalURLString} from '../utils';

import MainWindow from './mainWindow';

export class SettingsWindow {
    private win?: BrowserWindow;

    constructor() {
        ipcMain.on(SHOW_SETTINGS_WINDOW, this.show);
    }

    show = () => {
        if (this.win) {
            this.win.show();
        } else {
            this.create();
        }
    }

    get = () => {
        return this.win;
    }

    private create = () => {
        const mainWindow = MainWindow.get(true);
        if (!mainWindow) {
            return;
        }

        const preload = getLocalPreload('desktopAPI.js');
        const spellcheck = (typeof Config.useSpellChecker === 'undefined' ? true : Config.useSpellChecker);
        this.win = new BrowserWindow({
            parent: mainWindow,
            title: 'Desktop App Settings',
            fullscreen: false,
            webPreferences: {
                preload,
                spellcheck,
            }});

        const contextMenu = new ContextMenu({}, this.win);
        contextMenu.reload();

        const localURL = getLocalURLString('settings.html');
        this.win.setMenuBarVisibility(false);
        this.win.loadURL(localURL).catch(
            (reason) => {
                log.error('failed to load', reason);
            });
        this.win.show();

        if (Boolean(process.env.MM_DEBUG_SETTINGS) || false) {
            this.win.webContents.openDevTools({mode: 'detach'});
        }

        this.win.on('closed', () => {
            delete this.win;
        });
    }
}

const settingsWindow = new SettingsWindow();
export default settingsWindow;
