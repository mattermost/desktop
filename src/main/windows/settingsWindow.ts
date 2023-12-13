// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, ipcMain} from 'electron';

import {SHOW_SETTINGS_WINDOW} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';

import ContextMenu from '../contextMenu';
import {getLocalPreload, getLocalURLString} from '../utils';

import MainWindow from './mainWindow';

const log = new Logger('SettingsWindow');

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

    sendToRenderer = (channel: string, ...args: any[]) => {
        this.win?.webContents.send(channel, ...args);
    }

    private create = () => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        const preload = getLocalPreload('internalAPI.js');
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

            // For some reason, on macOS, the app will hard crash when the settings window is closed
            // It seems to be related to calling view.focus() and there's no log output unfortunately
            // Adding this arbitrary delay seems to get rid of it (it happens very frequently)
            setTimeout(() => MainWindow.get()?.focus(), 10);
        });
    }
}

const settingsWindow = new SettingsWindow();
export default settingsWindow;
