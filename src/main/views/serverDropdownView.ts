// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent} from 'electron';
import {WebContentsView, ipcMain} from 'electron';

import ServerViewState from 'app/serverViewState';
import AppState from 'common/appState';
import {
    CLOSE_SERVERS_DROPDOWN,
    EMIT_CONFIGURATION,
    OPEN_SERVERS_DROPDOWN,
    UPDATE_SERVERS_DROPDOWN,
    UPDATE_APPSTATE,
    REQUEST_SERVERS_DROPDOWN_INFO,
    RECEIVE_DROPDOWN_MENU_SIZE,
    SERVERS_UPDATE,
    MAIN_WINDOW_CREATED,
    MAIN_WINDOW_RESIZED,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {TAB_BAR_HEIGHT, THREE_DOT_MENU_WIDTH, THREE_DOT_MENU_WIDTH_MAC, MENU_SHADOW_WIDTH} from 'common/utils/constants';
import performanceMonitor from 'main/performanceMonitor';
import {getLocalPreload} from 'main/utils';

import type {UniqueServer} from 'types/config';

import MainWindow from '../windows/mainWindow';

const log = new Logger('ServerDropdownView');

export class ServerDropdownView {
    private view?: WebContentsView;
    private servers: UniqueServer[];
    private hasGPOServers: boolean;
    private isOpen: boolean;
    private bounds: Electron.Rectangle;

    private unreads: Map<string, boolean>;
    private mentions: Map<string, number>;
    private expired: Map<string, boolean>;

    private windowBounds?: Electron.Rectangle;

    constructor() {
        this.servers = [];
        this.hasGPOServers = false;
        this.isOpen = false;
        this.bounds = this.getBounds(0, 0);

        this.unreads = new Map();
        this.mentions = new Map();
        this.expired = new Map();

        MainWindow.on(MAIN_WINDOW_CREATED, this.init);
        MainWindow.on(MAIN_WINDOW_RESIZED, this.updateWindowBounds);

        ipcMain.on(OPEN_SERVERS_DROPDOWN, this.handleOpen);
        ipcMain.on(CLOSE_SERVERS_DROPDOWN, this.handleClose);
        ipcMain.on(RECEIVE_DROPDOWN_MENU_SIZE, this.handleReceivedMenuSize);

        ipcMain.on(EMIT_CONFIGURATION, this.updateDropdown);
        ipcMain.on(REQUEST_SERVERS_DROPDOWN_INFO, this.updateDropdown);

        AppState.on(UPDATE_APPSTATE, this.updateMentions);
        ServerManager.on(SERVERS_UPDATE, this.updateServers);
    }

    private updateWindowBounds = (newBounds: Electron.Rectangle) => {
        this.windowBounds = newBounds;
        this.updateDropdown();
    };

    private init = () => {
        log.info('init');
        this.view = new WebContentsView({webPreferences: {preload: getLocalPreload('internalAPI.js')}});
        this.view.setBackgroundColor('#00000000');
        performanceMonitor.registerView('ServerDropdownView', this.view.webContents);
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
            Config.darkMode,
            this.windowBounds,
            ServerManager.hasServers() ? ServerViewState.getCurrentServer().id : undefined,
            Config.enableServerManagement,
            this.hasGPOServers,
            this.expired,
            this.mentions,
            this.unreads,
        );
    };

    private updateServers = () => {
        this.setOrderedServers();
        this.updateDropdown();
    };

    private updateMentions = (expired: Map<string, boolean>, mentions: Map<string, number>, unreads: Map<string, boolean>) => {
        log.silly('updateMentions', {expired, mentions, unreads});

        this.unreads = this.reduceNotifications(this.unreads, unreads, (base, value) => base || value || false);
        this.mentions = this.reduceNotifications(this.mentions, mentions, (base, value) => (base ?? 0) + (value ?? 0));
        this.expired = this.reduceNotifications(this.expired, expired, (base, value) => base || value || false);
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

    private reduceNotifications = <T>(inputMap: Map<string, T>, items: Map<string, T>, modifier: (base?: T, value?: T) => T) => {
        inputMap.clear();
        return [...items.keys()].reduce((map, key) => {
            const view = ServerManager.getView(key);
            if (!view) {
                return map;
            }
            map.set(view.server.id, modifier(map.get(view.server.id), items.get(key)));
            return map;
        }, inputMap);
    };

    private setOrderedServers = () => {
        this.servers = ServerManager.getOrderedServers().map((server) => server.toUniqueServer());
        this.hasGPOServers = this.servers.some((srv) => srv.isPredefined);
    };
}

const serverDropdownView = new ServerDropdownView();
export default serverDropdownView;
