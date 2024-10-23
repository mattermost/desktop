// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent} from 'electron';
import {WebContentsView, ipcMain} from 'electron';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    EMIT_CONFIGURATION,
    OPEN_DOWNLOADS_DROPDOWN,
    RECEIVE_DOWNLOADS_DROPDOWN_SIZE,
    REQUEST_CLEAR_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    UPDATE_DOWNLOADS_DROPDOWN,
    UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM,
    DOWNLOADS_DROPDOWN_OPEN_FILE,
    MAIN_WINDOW_CREATED,
    MAIN_WINDOW_RESIZED,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import {TAB_BAR_HEIGHT, DOWNLOADS_DROPDOWN_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT, DOWNLOADS_DROPDOWN_FULL_WIDTH} from 'common/utils/constants';
import downloadsManager from 'main/downloadsManager';
import performanceMonitor from 'main/performanceMonitor';
import {getLocalPreload} from 'main/utils';
import MainWindow from 'main/windows/mainWindow';

import type {DownloadedItem} from 'types/downloads';

const log = new Logger('DownloadsDropdownView');

export class DownloadsDropdownView {
    private bounds?: Electron.Rectangle;
    private windowBounds?: Electron.Rectangle;
    private item?: DownloadedItem;
    private view?: WebContentsView;

    constructor() {
        MainWindow.on(MAIN_WINDOW_CREATED, this.init);
        MainWindow.on(MAIN_WINDOW_RESIZED, this.updateWindowBounds);
        ipcMain.on(OPEN_DOWNLOADS_DROPDOWN, this.handleOpen);
        ipcMain.on(CLOSE_DOWNLOADS_DROPDOWN, this.handleClose);
        ipcMain.on(EMIT_CONFIGURATION, this.updateDownloadsDropdown);
        ipcMain.on(REQUEST_DOWNLOADS_DROPDOWN_INFO, this.updateDownloadsDropdown);
        ipcMain.on(REQUEST_CLEAR_DOWNLOADS_DROPDOWN, this.clearDownloads);
        ipcMain.on(RECEIVE_DOWNLOADS_DROPDOWN_SIZE, this.handleReceivedDownloadsDropdownSize);
        ipcMain.on(DOWNLOADS_DROPDOWN_OPEN_FILE, this.openFile);
        ipcMain.on(UPDATE_DOWNLOADS_DROPDOWN, this.updateDownloadsDropdown);
        ipcMain.on(UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM, this.updateDownloadsDropdownMenuItem);
    }

    init = () => {
        this.windowBounds = MainWindow.getBounds();
        if (!this.windowBounds) {
            throw new Error('Cannot initialize, no main window');
        }
        this.bounds = this.getBounds(this.windowBounds.width, DOWNLOADS_DROPDOWN_FULL_WIDTH, DOWNLOADS_DROPDOWN_HEIGHT);
        this.view = new WebContentsView({webPreferences: {preload: getLocalPreload('internalAPI.js')}});
        this.view.setBackgroundColor('#00000000');
        performanceMonitor.registerView('DownloadsDropdownView', this.view.webContents);
        this.view.webContents.loadURL('mattermost-desktop://renderer/downloadsDropdown.html');
        MainWindow.get()?.contentView.addChildView(this.view);
    };

    /**
     * This is called every time the "window" is resized so that we can position
     * the downloads dropdown at the correct position
     */
    private updateWindowBounds = (newBounds: Electron.Rectangle) => {
        log.silly('updateWindowBounds');

        this.windowBounds = newBounds;
        this.updateDownloadsDropdown();
        this.repositionDownloadsDropdown();
    };

    private updateDownloadsDropdownMenuItem = (event: IpcMainEvent, item?: DownloadedItem) => {
        log.silly('updateDownloadsDropdownMenuItem', {item});
        this.item = item;
        this.updateDownloadsDropdown();
    };

    private updateDownloadsDropdown = () => {
        log.silly('updateDownloadsDropdown');

        this.view?.webContents.send(
            UPDATE_DOWNLOADS_DROPDOWN,
            downloadsManager.getDownloads(),
            Config.darkMode,
            MainWindow.getBounds(),
            this.item,
        );
    };

    private handleOpen = () => {
        log.debug('handleOpen', {bounds: this.bounds});

        if (!(this.bounds && this.view)) {
            return;
        }

        this.view.setBounds(this.bounds);
        MainWindow.get()?.contentView.addChildView(this.view);
        this.view.webContents.focus();
        downloadsManager.onOpen();
        MainWindow.sendToRenderer(OPEN_DOWNLOADS_DROPDOWN);
    };

    private handleClose = () => {
        log.silly('handleClose');

        this.view?.setBounds(this.getBounds(this.windowBounds?.width ?? 0, 0, 0));
        downloadsManager.onClose();
        MainWindow.sendToRenderer(CLOSE_DOWNLOADS_DROPDOWN);
    };

    private clearDownloads = () => {
        downloadsManager.clearDownloadsDropDown();
        this.handleClose();
    };

    private openFile = (e: IpcMainEvent, item: DownloadedItem) => {
        log.debug('openFile', {item});

        downloadsManager.openFile(item);
    };

    private getBounds = (windowWidth: number, width: number, height: number) => {
        // Must always use integers
        return {
            x: this.getX(windowWidth),
            y: this.getY(),
            width: Math.round(width),
            height: Math.round(height),
        };
    };

    private getX = (windowWidth: number) => {
        const result = windowWidth - DOWNLOADS_DROPDOWN_FULL_WIDTH;
        if (result <= DOWNLOADS_DROPDOWN_WIDTH) {
            return 0;
        }
        return Math.round(result);
    };

    private getY = () => {
        return Math.round(TAB_BAR_HEIGHT);
    };

    private repositionDownloadsDropdown = () => {
        if (!(this.bounds && this.windowBounds)) {
            return;
        }
        this.bounds = {
            ...this.bounds,
            x: this.getX(this.windowBounds.width),
            y: this.getY(),
        };
        if (downloadsManager.getIsOpen()) {
            this.view?.setBounds(this.bounds);
        }
    };

    private handleReceivedDownloadsDropdownSize = (event: IpcMainEvent, width: number, height: number) => {
        log.silly('handleReceivedDownloadsDropdownSize', {width, height});

        if (!this.windowBounds) {
            return;
        }

        this.bounds = this.getBounds(this.windowBounds.width, width, height);
        if (downloadsManager.getIsOpen()) {
            this.view?.setBounds(this.bounds);
        }
    };
}

const downloadsDropdownView = new DownloadsDropdownView();
export default downloadsDropdownView;
