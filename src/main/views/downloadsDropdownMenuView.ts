// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import type {IpcMainEvent} from 'electron';
import {WebContentsView, ipcMain} from 'electron';

import {
    CLOSE_DOWNLOADS_DROPDOWN_MENU,
    DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD,
    DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE,
    DOWNLOADS_DROPDOWN_MENU_OPEN_FILE,
    DOWNLOADS_DROPDOWN_MENU_SHOW_FILE_IN_FOLDER,
    EMIT_CONFIGURATION,
    MAIN_WINDOW_CREATED,
    MAIN_WINDOW_RESIZED,
    OPEN_DOWNLOADS_DROPDOWN_MENU,
    REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO,
    TOGGLE_DOWNLOADS_DROPDOWN_MENU,
    UPDATE_DOWNLOADS_DROPDOWN_MENU,
    UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import {
    DOWNLOADS_DROPDOWN_FULL_WIDTH,
    DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT,
    DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH,
    TAB_BAR_HEIGHT,
} from 'common/utils/constants';
import downloadsManager from 'main/downloadsManager';
import performanceMonitor from 'main/performanceMonitor';
import {getLocalPreload} from 'main/utils';
import MainWindow from 'main/windows/mainWindow';

import type {CoordinatesToJsonType, DownloadedItem, DownloadsMenuOpenEventPayload} from 'types/downloads';

const log = new Logger('DownloadsDropdownMenuView');

export class DownloadsDropdownMenuView {
    private open: boolean;
    private view?: WebContentsView;
    private bounds?: Electron.Rectangle;
    private item?: DownloadedItem;
    private coordinates?: CoordinatesToJsonType;
    private windowBounds?: Electron.Rectangle;

    constructor() {
        this.open = false;

        MainWindow.on(MAIN_WINDOW_CREATED, this.init);
        MainWindow.on(MAIN_WINDOW_RESIZED, this.updateWindowBounds);
        ipcMain.on(OPEN_DOWNLOADS_DROPDOWN_MENU, this.handleOpen);
        ipcMain.on(CLOSE_DOWNLOADS_DROPDOWN_MENU, this.handleClose);
        ipcMain.on(TOGGLE_DOWNLOADS_DROPDOWN_MENU, this.handleToggle);
        ipcMain.on(EMIT_CONFIGURATION, this.updateDownloadsDropdownMenu);
        ipcMain.on(REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO, this.updateDownloadsDropdownMenu);
        ipcMain.on(DOWNLOADS_DROPDOWN_MENU_OPEN_FILE, this.openFile);
        ipcMain.on(DOWNLOADS_DROPDOWN_MENU_SHOW_FILE_IN_FOLDER, this.showFileInFolder);
        ipcMain.on(DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD, this.cancelDownload);
        ipcMain.on(DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE, this.clearFile);
        ipcMain.on(UPDATE_DOWNLOADS_DROPDOWN_MENU, this.updateItem);
    }

    private init = () => {
        this.windowBounds = MainWindow.getBounds();
        if (!this.windowBounds) {
            throw new Error('Cannot initialize downloadsDropdownMenuView, missing MainWindow');
        }
        this.bounds = this.getBounds(this.windowBounds.width, DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT);
        this.view = new WebContentsView({webPreferences: {preload: getLocalPreload('internalAPI.js')}});
        this.view.setBackgroundColor('#00000000');
        performanceMonitor.registerView('DownloadsDropdownMenuView', this.view.webContents);
        this.view.webContents.loadURL('mattermost-desktop://renderer/downloadsDropdownMenu.html');
        MainWindow.get()?.contentView.addChildView(this.view);
    };

    /**
     * This is called every time the "window" is resized so that we can position
     * the downloads dropdown at the correct position
     */
    private updateWindowBounds = (newBounds: Electron.Rectangle) => {
        log.silly('updateWindowBounds');

        this.windowBounds = newBounds;
        this.updateDownloadsDropdownMenu();
        this.repositionDownloadsDropdownMenu();
    };

    private updateItem = (event: IpcMainEvent, item: DownloadedItem) => {
        log.debug('updateItem', {item});

        this.item = item;
        this.updateDownloadsDropdownMenu();
    };

    private updateDownloadsDropdownMenu = () => {
        log.silly('updateDownloadsDropdownMenu');

        this.view?.webContents.send(
            UPDATE_DOWNLOADS_DROPDOWN_MENU,
            this.item,
            Config.darkMode,
        );
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM, true, this.item);
        this.repositionDownloadsDropdownMenu();
    };

    private handleOpen = (event: IpcMainEvent, payload: DownloadsMenuOpenEventPayload = {} as DownloadsMenuOpenEventPayload) => {
        log.debug('handleOpen', {bounds: this.bounds, payload});

        if (!(this.bounds && this.view && this.windowBounds)) {
            return;
        }

        const {item, coordinates} = payload;

        log.debug('handleOpen', {item, coordinates});

        this.open = true;
        this.coordinates = coordinates;
        this.item = item;
        this.bounds = this.getBounds(this.windowBounds.width, DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT);
        this.view.setBounds(this.bounds);
        MainWindow.get()?.contentView.addChildView(this.view);
        this.view.webContents.focus();
        this.updateDownloadsDropdownMenu();
    };

    private handleClose = () => {
        log.silly('handleClose');

        this.open = false;
        this.item = undefined;
        ipcMain.emit(UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM);
        this.view?.setBounds(this.getBounds(this.windowBounds?.width ?? 0, 0, 0));
        MainWindow.sendToRenderer(CLOSE_DOWNLOADS_DROPDOWN_MENU);
    };

    private handleToggle = (event: IpcMainEvent, payload: DownloadsMenuOpenEventPayload) => {
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
    };

    private openFile = () => {
        downloadsManager.openFile(this.item);
        this.handleClose();
    };

    private showFileInFolder = (e: IpcMainEvent, item: DownloadedItem) => {
        downloadsManager.showFileInFolder(item);
        this.handleClose();
    };

    private clearFile = () => {
        downloadsManager.clearFile(this.item);
        this.handleClose();
    };

    private cancelDownload = () => {
        downloadsManager.cancelDownload(this.item);
        this.handleClose();
    };

    private getBounds = (windowWidth: number, width: number, height: number) => {
        // MUST return integers
        return {
            x: this.getX(windowWidth),
            y: this.getY(),
            width: Math.round(width),
            height: Math.round(height),
        };
    };

    private getX = (windowWidth: number) => {
        const result = (windowWidth - DOWNLOADS_DROPDOWN_FULL_WIDTH - DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH) + (this.coordinates?.x || 0) + (this.coordinates?.width || 0);
        if (result <= DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH) {
            return 0;
        }
        return Math.round(result);
    };

    private getY = () => {
        const result = TAB_BAR_HEIGHT + (this.coordinates?.y || 0) + (this.coordinates?.height || 0);
        return Math.round(result);
    };

    private repositionDownloadsDropdownMenu = () => {
        if (!this.windowBounds) {
            return;
        }

        this.bounds = this.getBounds(this.windowBounds.width, DOWNLOADS_DROPDOWN_MENU_FULL_WIDTH, DOWNLOADS_DROPDOWN_MENU_FULL_HEIGHT);
        if (this.open) {
            this.view?.setBounds(this.bounds);
        }
    };
}

const downloadsDropdownMenuView = new DownloadsDropdownMenuView();
export default downloadsDropdownMenuView;
