// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {BrowserView, BrowserWindow, ipcMain, IpcMainEvent} from 'electron';

import log from 'electron-log';

import {CombinedConfig} from 'types/config';
import {CoordinatesToJsonType, DownloadedItem, DownloadsMenuOpenEventPayload} from 'types/downloads';

import {
    CLOSE_DOWNLOADS_DROPDOWN_MENU,
    DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD,
    DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE,
    DOWNLOADS_DROPDOWN_MENU_OPEN_FILE,
    EMIT_CONFIGURATION,
    OPEN_DOWNLOADS_DROPDOWN_MENU,
    REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO,
    TOGGLE_DOWNLOADS_DROPDOWN_MENU,
    UPDATE_DOWNLOADS_DROPDOWN_MENU,
    UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM,
} from 'common/communication';
import {
    DOWNLOADS_DROPDOWN_FULL_WIDTH,
    DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT,
    DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH,
    TAB_BAR_HEIGHT,
} from 'common/utils/constants';
import {getLocalPreload, getLocalURLString} from 'main/utils';

import WindowManager from '../windows/windowManager';
import downloadsManager from 'main/downloadsManager';

export default class DownloadsDropdownMenuView {
    open: boolean;
    view: BrowserView;
    bounds?: Electron.Rectangle;
    item?: DownloadedItem;
    coordinates?: CoordinatesToJsonType;
    darkMode: boolean;
    window: BrowserWindow;
    windowBounds: Electron.Rectangle;

    constructor(window: BrowserWindow, darkMode: boolean) {
        this.open = false;
        this.item = undefined;
        this.coordinates = undefined;
        this.window = window;
        this.darkMode = darkMode;

        this.windowBounds = this.window.getContentBounds();
        this.bounds = this.getBounds(DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT);

        const preload = getLocalPreload('downloadsDropdownMenu.js');
        this.view = new BrowserView({webPreferences: {
            preload,

            // Workaround for this issue: https://github.com/electron/electron/issues/30993
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            transparent: true,
        }});

        this.view.webContents.loadURL(getLocalURLString('downloadsDropdownMenu.html'));
        this.window.addBrowserView(this.view);

        ipcMain.on(OPEN_DOWNLOADS_DROPDOWN_MENU, this.handleOpen);
        ipcMain.on(CLOSE_DOWNLOADS_DROPDOWN_MENU, this.handleClose);
        ipcMain.on(TOGGLE_DOWNLOADS_DROPDOWN_MENU, this.handleToggle);
        ipcMain.on(EMIT_CONFIGURATION, this.updateConfig);
        ipcMain.on(REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO, this.updateDownloadsDropdownMenu);
        ipcMain.on(DOWNLOADS_DROPDOWN_MENU_OPEN_FILE, this.openFile);
        ipcMain.on(DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD, this.cancelDownload);
        ipcMain.on(DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE, this.clearFile);
        ipcMain.on(UPDATE_DOWNLOADS_DROPDOWN_MENU, this.updateItem);
    }

    updateItem = (event: IpcMainEvent, item: DownloadedItem) => {
        log.debug('DownloadsDropdownMenuView.updateItem', {item});

        this.item = item;

        this.updateDownloadsDropdownMenu();
    }

    updateConfig = (event: IpcMainEvent, config: CombinedConfig) => {
        log.debug('DownloadsDropdownMenuView.updateConfig');

        this.darkMode = config.darkMode;
        this.updateDownloadsDropdownMenu();
    }

    /**
     * This is called every time the "window" is resized so that we can position
     * the downloads dropdown at the correct position
     */
    updateWindowBounds = () => {
        log.debug('DownloadsDropdownMenuView.updateWindowBounds');

        this.windowBounds = this.window.getContentBounds();
        this.updateDownloadsDropdownMenu();
        this.repositionDownloadsDropdownMenu();
    }

    updateDownloadsDropdownMenu = () => {
        log.debug('DownloadsDropdownMenuView.updateDownloadsDropdownMenu');

        this.view.webContents.send(
            UPDATE_DOWNLOADS_DROPDOWN_MENU,
            this.item,
            this.darkMode,
        );
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM, true, this.item);
        this.repositionDownloadsDropdownMenu();
    }

    handleOpen = (event: IpcMainEvent, payload: DownloadsMenuOpenEventPayload = {} as DownloadsMenuOpenEventPayload) => {
        log.debug('DownloadsDropdownMenuView.handleOpen', {bounds: this.bounds, payload});

        if (!this.bounds) {
            return;
        }

        const {item, coordinates} = payload;

        log.debug('DownloadsDropdownMenuView.handleOpen', {item, coordinates});

        this.open = true;
        this.coordinates = coordinates;
        this.item = item;
        this.bounds = this.getBounds(DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT);
        this.view.setBounds(this.bounds);
        this.window.setTopBrowserView(this.view);
        this.view.webContents.focus();
        this.updateDownloadsDropdownMenu();
    }

    handleClose = () => {
        log.debug('DownloadsDropdownMenuView.handleClose');

        this.open = false;
        this.item = undefined;
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM);
        this.view.setBounds(this.getBounds(0, 0));
        WindowManager.sendToRenderer(CLOSE_DOWNLOADS_DROPDOWN_MENU);
    }

    handleToggle = (event: IpcMainEvent, payload: DownloadsMenuOpenEventPayload) => {
        if (this.open) {
            if (this.item?.location === payload.item.location) {
                // clicking 3-dot in the same item
                this.handleClose();
            } else {
                // clicking 3-dot in a different item
                this.handleClose();
                this.handleOpen(event, payload);
            }
        } else {
            this.handleOpen(event, payload);
        }
    }

    openFile = () => {
        downloadsManager.openFile(this.item);
        this.handleClose();
    }

    clearFile = () => {
        downloadsManager.clearFile(this.item);
        this.handleClose();
    }

    cancelDownload = () => {
        downloadsManager.cancelDownload(this.item);
        this.handleClose();
    }

    getBounds = (width: number, height: number) => {
        // MUST return integers
        return {
            x: this.getX(),
            y: this.getY(),
            width: Math.round(width),
            height: Math.round(height),
        };
    }

    getX = () => {
        const result = (this.windowBounds.width - DOWNLOADS_DROPDOWN_FULL_WIDTH - DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH) + (this.coordinates?.x || 0) + (this.coordinates?.width || 0);
        if (result <= DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH) {
            return 0;
        }
        return Math.round(result);
    }

    getY = () => {
        const result = TAB_BAR_HEIGHT + (this.coordinates?.y || 0) + (this.coordinates?.height || 0);
        return Math.round(result);
    }

    repositionDownloadsDropdownMenu = () => {
        this.bounds = this.getBounds(DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT);
        if (this.open) {
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
