// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, BrowserWindow, ipcMain, IpcMainEvent} from 'electron';

import log from 'electron-log';

import {CombinedConfig, DownloadItems} from 'types/config';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    EMIT_CONFIGURATION,
    OPEN_DOWNLOADS_DROPDOWN,
    UPDATE_DOWNLOADS_DROPDOWN,
} from 'common/communication';
import {getLocalPreload, getLocalURLString} from 'main/utils';
import WindowManager from '../windows/windowManager';

export default class DownloadsDropdownView {
    view: BrowserView;
    bounds?: Electron.Rectangle;
    downloads: DownloadItems;
    darkMode: boolean;
    window: BrowserWindow;
    isOpen: boolean;

    constructor(window: BrowserWindow, downloads: DownloadItems, darkMode: boolean) {
        this.downloads = downloads;
        this.window = window;
        this.darkMode = darkMode;
        this.isOpen = false;

        const preload = getLocalPreload('dropdown.js');
        this.view = new BrowserView({webPreferences: {
            preload,

            // Workaround for this issue: https://github.com/electron/electron/issues/30993
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            transparent: true,
        }});

        this.view.webContents.loadURL(getLocalURLString('downloadsDropdown.html'));
        this.window.addBrowserView(this.view);

        ipcMain.on(OPEN_DOWNLOADS_DROPDOWN, this.handleOpen);
        ipcMain.on(CLOSE_DOWNLOADS_DROPDOWN, this.handleClose);
        ipcMain.on(EMIT_CONFIGURATION, this.updateConfig);
    }

    updateConfig = (event: IpcMainEvent, config: CombinedConfig) => {
        log.silly('DownloadsDropdownView.config', {config});

        this.downloads = config.downloads;
        this.darkMode = config.darkMode;
        this.updateDropdown();
    }

    updateDropdown = () => {
        log.silly('DownloadsDropdownView.updateDropdown');

        this.view.webContents.send(
            UPDATE_DOWNLOADS_DROPDOWN,
            this.downloads,
            this.darkMode,
        );
    }

    handleOpen = () => {
        log.debug('DownloadsDropdownView.handleOpen');

        this.window.setTopBrowserView(this.view);
        this.view.webContents.focus();
        WindowManager.sendToRenderer(OPEN_DOWNLOADS_DROPDOWN);
        this.isOpen = true;
    }

    handleClose = () => {
        log.debug('DownloadsDropdownView.handleClose');

        WindowManager.sendToRenderer(CLOSE_DOWNLOADS_DROPDOWN);
        this.isOpen = false;
    }


    destroy = () => {
        // workaround to eliminate zombie processes
        // https://github.com/mattermost/desktop/pull/1519
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.view.webContents.destroy();
    }
}
