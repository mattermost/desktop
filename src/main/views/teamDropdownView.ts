// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, BrowserWindow, ipcMain, IpcMainEvent} from 'electron';
import log from 'electron-log';
import {CombinedConfig, Team} from 'types/config';

import {
    CLOSE_TEAMS_DROPDOWN,
    EMIT_CONFIGURATION,
    OPEN_TEAMS_DROPDOWN,
    UPDATE_TEAMS_DROPDOWN,
    UPDATE_DROPDOWN_MENTIONS,
    REQUEST_TEAMS_DROPDOWN_INFO,
    RECEIVE_DROPDOWN_MENU_SIZE,
} from 'common/communication';
import * as AppState from '../appState';
import {TAB_BAR_HEIGHT, THREE_DOT_MENU_WIDTH, THREE_DOT_MENU_WIDTH_MAC} from 'common/utils/constants';
import {getLocalPreload, getLocalURLString, getWindowBoundaries} from 'main/utils';
import * as WindowManager from '../windows/windowManager';

export default class TeamDropdownView {
    view: BrowserView;
    bounds?: Electron.Rectangle;
    teams: Team[];
    unreads?: Map<string, boolean>;
    mentions?: Map<string, number>;
    expired?: Map<string, boolean>;
    window: BrowserWindow;

    constructor(window: BrowserWindow, teams: Team[]) {
        this.teams = teams;
        this.window = window;

        const preload = getLocalPreload('dropdown.js');
        this.view = new BrowserView({webPreferences: {
            contextIsolation: process.env.NODE_ENV !== 'test',
            preload,
            nodeIntegration: process.env.NODE_ENV === 'test',
            enableRemoteModule: process.env.NODE_ENV === 'test',
        }});

        this.view.webContents.loadURL(getLocalURLString('dropdown.html'));
        this.view.webContents.openDevTools({mode: 'detach'});

        ipcMain.on(OPEN_TEAMS_DROPDOWN, this.handleOpen);
        ipcMain.on(CLOSE_TEAMS_DROPDOWN, this.handleClose);
        ipcMain.on(EMIT_CONFIGURATION, this.updateTeams);
        ipcMain.on(REQUEST_TEAMS_DROPDOWN_INFO, this.updateDropdown);
        ipcMain.on(RECEIVE_DROPDOWN_MENU_SIZE, this.handleReceivedMenuSize);
        AppState.on(UPDATE_DROPDOWN_MENTIONS, this.updateMentions);
    }

    updateTeams = (event: IpcMainEvent, config: CombinedConfig) => {
        this.teams = config.teams;
        this.updateDropdown();
    }

    updateMentions = (expired: Map<string, boolean>, mentions: Map<string, number>, unreads: Map<string, boolean>) => {
        this.unreads = unreads;
        this.mentions = mentions;
        this.expired = expired;
        this.updateDropdown();
    }

    updateDropdown = () => {
        this.view.webContents.send(UPDATE_TEAMS_DROPDOWN, this.teams, this.expired, this.mentions, this.unreads);
    }

    handleOpen = () => {
        this.window.addBrowserView(this.view);
        WindowManager.sendToRenderer(OPEN_TEAMS_DROPDOWN);
    }

    handleClose = () => {
        this.window.removeBrowserView(this.view);
        WindowManager.sendToRenderer(CLOSE_TEAMS_DROPDOWN);
    }

    handleReceivedMenuSize = (event: IpcMainEvent, width: number, height: number) => {
        const bounds = this.getBounds(width, height);
        this.view.setBounds(bounds);
    }

    getBounds = (width: number, height: number) => {
        return {
            x: process.platform === 'darwin' ? THREE_DOT_MENU_WIDTH_MAC : THREE_DOT_MENU_WIDTH,
            y: TAB_BAR_HEIGHT,
            width,
            height,
        };
    }

    destroy = () => {
        // workaround to eliminate zombie processes
        // https://github.com/mattermost/desktop/pull/1519
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.view.webContents.destroy();
    }
}
