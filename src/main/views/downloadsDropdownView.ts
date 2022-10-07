// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {BrowserView, BrowserWindow, ipcMain, IpcMainEvent} from 'electron';

import log from 'electron-log';

import {CombinedConfig} from 'types/config';
import {DownloadedItem, DownloadedItems} from 'types/downloads';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER,
    EMIT_CONFIGURATION,
    OPEN_DOWNLOADS_DROPDOWN,
    RECEIVE_DOWNLOADS_DROPDOWN_SIZE,
    REQUEST_CLEAR_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    UPDATE_DOWNLOADS_DROPDOWN,
    UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM,
} from 'common/communication';
import {TAB_BAR_HEIGHT, DOWNLOADS_DROPDOWN_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT, DOWNLOADS_DROPDOWN_FULL_WIDTH} from 'common/utils/constants';
import {getLocalPreload, getLocalURLString} from 'main/utils';

import WindowManager from '../windows/windowManager';
import downloadsManager from 'main/downloadsManager';

export default class DownloadsDropdownView {
    bounds?: Electron.Rectangle;
    darkMode: boolean;
    downloads: DownloadedItems;
    item: DownloadedItem | undefined;
    view: BrowserView;
    window: BrowserWindow;
    windowBounds: Electron.Rectangle;

    constructor(window: BrowserWindow, downloads: DownloadedItems, darkMode: boolean) {
        this.downloads = downloads;
        this.window = window;
        this.darkMode = darkMode;
        this.item = undefined;

        this.windowBounds = this.window.getContentBounds();
        this.bounds = this.getBounds(DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT);

        const preload = getLocalPreload('downloadsDropdown.js');
        this.view = new BrowserView({webPreferences: {
            preload,

            // Workaround for this issue: https://github.com/electron/electron/issues/30993
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            transparent: true,
        }});

        this.view.webContents.loadURL(getLocalURLString('downloadsDropdown.html'));
        this.window.addBrowserView(this.view);

        this.view.webContents.session.webRequest.onHeadersReceived(downloadsManager.webRequestOnHeadersReceivedHandler);

        ipcMain.on(OPEN_DOWNLOADS_DROPDOWN, this.handleOpen);
        ipcMain.on(CLOSE_DOWNLOADS_DROPDOWN, this.handleClose);
        ipcMain.on(EMIT_CONFIGURATION, this.updateConfig);
        ipcMain.on(REQUEST_DOWNLOADS_DROPDOWN_INFO, this.updateDownloadsDropdown);
        ipcMain.on(REQUEST_CLEAR_DOWNLOADS_DROPDOWN, this.clearDownloads);
        ipcMain.on(RECEIVE_DOWNLOADS_DROPDOWN_SIZE, this.handleReceivedDownloadsDropdownSize);
        ipcMain.on(DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER, this.showFileInFolder);
        ipcMain.on(UPDATE_DOWNLOADS_DROPDOWN, this.updateDownloads);
        ipcMain.on(UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM, this.updateDownloadsDropdownMenuItem);
    }

    updateDownloads = (event: IpcMainEvent, downloads: DownloadedItems) => {
        log.debug('DownloadsDropdownView.updateDownloads', {downloads});

        this.downloads = downloads;

        this.updateDownloadsDropdown();
    }

    updateDownloadsDropdownMenuItem = (event: IpcMainEvent, item?: DownloadedItem) => {
        log.debug('DownloadsDropdownView.updateDownloadsDropdownMenuItem', {item});
        this.item = item;
        this.updateDownloadsDropdown();
    }

    updateConfig = (event: IpcMainEvent, config: CombinedConfig) => {
        log.debug('DownloadsDropdownView.updateConfig');

        this.darkMode = config.darkMode;
        this.updateDownloadsDropdown();
    }

    /**
     * This is called every time the "window" is resized so that we can position
     * the downloads dropdown at the correct position
     */
    updateWindowBounds = () => {
        log.debug('DownloadsDropdownView.updateWindowBounds');

        this.windowBounds = this.window.getContentBounds();
        this.updateDownloadsDropdown();
        this.repositionDownloadsDropdown();
    }

    updateDownloadsDropdown = () => {
        log.debug('DownloadsDropdownView.updateDownloadsDropdown');

        this.view.webContents.send(
            UPDATE_DOWNLOADS_DROPDOWN,
            this.downloads,
            this.darkMode,
            this.windowBounds,
            this.item,
        );
    }

    handleOpen = () => {
        log.debug('DownloadsDropdownView.handleOpen', {bounds: this.bounds});

        if (!this.bounds) {
            return;
        }

        this.view.setBounds(this.bounds);
        this.window.setTopBrowserView(this.view);
        this.view.webContents.focus();
        downloadsManager.onOpen();
        WindowManager.sendToRenderer(OPEN_DOWNLOADS_DROPDOWN);
    }

    handleClose = () => {
        log.debug('DownloadsDropdownView.handleClose');

        this.view.setBounds(this.getBounds(0, 0));
        downloadsManager.onClose();
        WindowManager.sendToRenderer(CLOSE_DOWNLOADS_DROPDOWN);
    }

    clearDownloads = () => {
        downloadsManager.clearDownloadsDropDown();
        this.handleClose();
    }

    showFileInFolder = (e: IpcMainEvent, item: DownloadedItem) => {
        log.debug('DownloadsDropdownView.showFileInFolder', {item});

        downloadsManager.showFileInFolder(item);
    }

    getBounds = (width: number, height: number) => {
        // Must always use integers
        return {
            x: this.getX(this.windowBounds.width),
            y: this.getY(),
            width: Math.round(width),
            height: Math.round(height),
        };
    }

    getX = (windowWidth: number) => {
        const result = windowWidth - DOWNLOADS_DROPDOWN_FULL_WIDTH;
        if (result <= DOWNLOADS_DROPDOWN_WIDTH) {
            return 0;
        }
        return Math.round(result);
    }

    getY = () => {
        return Math.round(TAB_BAR_HEIGHT);
    }

    repositionDownloadsDropdown = () => {
        if (!this.bounds) {
            return;
        }
        this.bounds = {
            ...this.bounds,
            x: this.getX(this.windowBounds.width),
            y: this.getY(),
        };
        if (downloadsManager.getIsOpen()) {
            this.view.setBounds(this.bounds);
        }
    }

    handleReceivedDownloadsDropdownSize = (event: IpcMainEvent, width: number, height: number) => {
        log.silly('DownloadsDropdownView.handleReceivedDownloadsDropdownSize', {width, height});

        this.bounds = this.getBounds(width, height);
        if (downloadsManager.getIsOpen()) {
            this.view.setBounds(this.bounds);
        }
    }

    destroy = () => {
        // workaround to eliminate zombie processes
        // https://github.com/mattermost/desktop/pull/1519
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.view.webContents.destroy();
    }
}
