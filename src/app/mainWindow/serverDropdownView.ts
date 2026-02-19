// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent} from 'electron';
import {WebContentsView, ipcMain} from 'electron';

import AppState from 'common/appState';
import {
    CLOSE_SERVERS_DROPDOWN,
    EMIT_CONFIGURATION,
    OPEN_SERVERS_DROPDOWN,
    UPDATE_SERVERS_DROPDOWN,
    REQUEST_SERVERS_DROPDOWN_INFO,
    RECEIVE_DROPDOWN_MENU_SIZE,
    MAIN_WINDOW_CREATED,
    MAIN_WINDOW_RESIZED,
    SERVER_REMOVED,
    SERVER_ADDED,
    SERVER_NAME_CHANGED,
    SERVER_SWITCHED,
    SWITCH_SERVER,
    SERVER_ORDER_UPDATED,
    UPDATE_APPSTATE_FOR_SERVER_ID,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {TAB_BAR_HEIGHT, THREE_DOT_MENU_WIDTH, THREE_DOT_MENU_WIDTH_MAC, MENU_SHADOW_WIDTH} from 'common/utils/constants';
import performanceMonitor from 'main/performanceMonitor';
import ThemeManager from 'main/themeManager';
import {getLocalPreload} from 'main/utils';

import type {UniqueServer} from 'types/config';

import MainWindow from './mainWindow';

const log = new Logger('ServerDropdownView');

export class ServerDropdownView {
    private view?: WebContentsView;
    private servers: UniqueServer[];
    private isOpen: boolean;
    private bounds: Electron.Rectangle;

    private windowBounds?: Electron.Rectangle;

    constructor() {
        this.servers = [];
        this.isOpen = false;
        this.bounds = this.getBounds(0, 0);

        MainWindow.on(MAIN_WINDOW_CREATED, this.init);
        MainWindow.on(MAIN_WINDOW_RESIZED, this.updateWindowBounds);

        ipcMain.on(OPEN_SERVERS_DROPDOWN, this.handleOpen);
        ipcMain.on(CLOSE_SERVERS_DROPDOWN, this.handleClose);
        ipcMain.on(RECEIVE_DROPDOWN_MENU_SIZE, this.handleReceivedMenuSize);
        ipcMain.on(SWITCH_SERVER, this.handleSwitchServer);

        ipcMain.on(EMIT_CONFIGURATION, this.updateDropdown);
        ipcMain.on(REQUEST_SERVERS_DROPDOWN_INFO, this.updateDropdown);
        AppState.on(UPDATE_APPSTATE_FOR_SERVER_ID, this.updateDropdown);

        ServerManager.on(SERVER_ADDED, this.updateServers);
        ServerManager.on(SERVER_REMOVED, this.updateServers);
        ServerManager.on(SERVER_NAME_CHANGED, this.updateServers);
        ServerManager.on(SERVER_SWITCHED, this.updateServers);
        ServerManager.on(SERVER_ORDER_UPDATED, this.updateServers);
    }

    private handleSwitchServer = (event: IpcMainEvent, serverId: string) => {
        ServerManager.updateCurrentServer(serverId);
    };

    private updateWindowBounds = (newBounds: Electron.Rectangle) => {
        this.windowBounds = newBounds;
        this.updateDropdown();
    };

    private init = () => {
        log.info('init');
        this.view = new WebContentsView({webPreferences: {preload: getLocalPreload('internalAPI.js')}});
        this.view.setBackgroundColor('#00000000');
        performanceMonitor.registerView('ServerDropdownView', this.view.webContents);
        ThemeManager.registerMainWindowView(this.view.webContents);
        this.view.webContents.loadURL('mattermost-desktop://renderer/dropdown.html');

        this.setOrderedServers();
        this.windowBounds = MainWindow.getBounds();
        this.updateDropdown();
        MainWindow.get()?.contentView.addChildView(this.view);
    };

    private updateDropdown = () => {
        log.silly('updateDropdown');

        this.view?.webContents.send(
            UPDATE_SERVERS_DROPDOWN,
            this.servers,
            this.windowBounds,
            ServerManager.hasServers() ? ServerManager.getCurrentServerId() : undefined,
            Config.enableServerManagement,
            AppState.getExpired(),
            AppState.getMentionsPerServer(),
            AppState.getUnreadsPerServer(),
        );
    };

    private updateServers = () => {
        this.setOrderedServers();
        this.updateDropdown();
    };

    /**
     * Menu open/close/size handlers
     */

    private handleOpen = () => {
        log.debug('handleOpen');

        if (!this.bounds) {
            return;
        }
        if (!this.view) {
            return;
        }
        this.view.setBounds(this.bounds);
        MainWindow.get()?.contentView.addChildView(this.view);
        this.view.webContents.focus();
        MainWindow.sendToRenderer(OPEN_SERVERS_DROPDOWN);
        this.isOpen = true;
    };

    private handleClose = () => {
        log.silly('handleClose');

        this.view?.setBounds(this.getBounds(0, 0));
        MainWindow.sendToRenderer(CLOSE_SERVERS_DROPDOWN);
        this.isOpen = false;
    };

    private handleReceivedMenuSize = (event: IpcMainEvent, width: number, height: number) => {
        log.silly('handleReceivedMenuSize', {width, height});

        this.bounds = this.getBounds(width, height);
        if (this.isOpen) {
            this.view?.setBounds(this.bounds);
        }
    };

    /**
     * Helpers
     */

    private getBounds = (width: number, height: number) => {
        return {
            x: (process.platform === 'darwin' ? THREE_DOT_MENU_WIDTH_MAC : THREE_DOT_MENU_WIDTH) - MENU_SHADOW_WIDTH,
            y: TAB_BAR_HEIGHT - MENU_SHADOW_WIDTH,
            width,
            height,
        };
    };

    private setOrderedServers = () => {
        this.servers = ServerManager.getOrderedServers().map((server) => server.toUniqueServer());
    };
}

const serverDropdownView = new ServerDropdownView();
export default serverDropdownView;
