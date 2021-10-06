// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, BrowserWindow, ipcMain, IpcMainEvent} from 'electron';
import {CombinedConfig, TeamWithTabs} from 'types/config';

import {
    CLOSE_TEAMS_DROPDOWN,
    EMIT_CONFIGURATION,
    OPEN_TEAMS_DROPDOWN,
    UPDATE_TEAMS_DROPDOWN,
    UPDATE_DROPDOWN_MENTIONS,
    REQUEST_TEAMS_DROPDOWN_INFO,
    RECEIVE_DROPDOWN_MENU_SIZE,
    SET_ACTIVE_VIEW,
} from 'common/communication';
import * as AppState from '../appState';
import {TAB_BAR_HEIGHT, THREE_DOT_MENU_WIDTH, THREE_DOT_MENU_WIDTH_MAC, MENU_SHADOW_WIDTH} from 'common/utils/constants';
import {getLocalPreload, getLocalURLString} from 'main/utils';
import * as WindowManager from '../windows/windowManager';

export default class TeamDropdownView {
    view: BrowserView;
    bounds?: Electron.Rectangle;
    teams: TeamWithTabs[];
    activeTeam?: string;
    darkMode: boolean;
    enableServerManagement?: boolean;
    hasGPOTeams?: boolean;
    unreads?: Map<string, boolean>;
    mentions?: Map<string, number>;
    expired?: Map<string, boolean>;
    window: BrowserWindow;
    windowBounds: Electron.Rectangle;
    isOpen: boolean;

    constructor(window: BrowserWindow, teams: TeamWithTabs[], darkMode: boolean, enableServerManagement: boolean) {
        this.teams = teams;
        this.window = window;
        this.darkMode = darkMode;
        this.enableServerManagement = enableServerManagement;
        this.isOpen = false;

        this.windowBounds = this.window.getContentBounds();

        const preload = getLocalPreload('dropdown.js');
        this.view = new BrowserView({webPreferences: {
            nativeWindowOpen: true,
            contextIsolation: process.env.NODE_ENV !== 'test',
            preload,
            nodeIntegration: process.env.NODE_ENV === 'test',
        }});

        this.view.webContents.loadURL(getLocalURLString('dropdown.html'));
        this.window.addBrowserView(this.view);

        ipcMain.on(OPEN_TEAMS_DROPDOWN, this.handleOpen);
        ipcMain.on(CLOSE_TEAMS_DROPDOWN, this.handleClose);
        ipcMain.on(EMIT_CONFIGURATION, this.updateConfig);
        ipcMain.on(REQUEST_TEAMS_DROPDOWN_INFO, this.updateDropdown);
        ipcMain.on(RECEIVE_DROPDOWN_MENU_SIZE, this.handleReceivedMenuSize);
        ipcMain.on(SET_ACTIVE_VIEW, this.updateActiveTeam);
        AppState.on(UPDATE_DROPDOWN_MENTIONS, this.updateMentions);
    }

    updateConfig = (event: IpcMainEvent, config: CombinedConfig) => {
        this.teams = config.teams;
        this.darkMode = config.darkMode;
        this.enableServerManagement = config.enableServerManagement;
        this.hasGPOTeams = config.registryTeams && config.registryTeams.length > 0;
        this.updateDropdown();
    }

    updateActiveTeam = (event: IpcMainEvent, name: string) => {
        this.activeTeam = name;
        this.updateDropdown();
    }

    updateMentions = (expired: Map<string, boolean>, mentions: Map<string, number>, unreads: Map<string, boolean>) => {
        this.unreads = unreads;
        this.mentions = mentions;
        this.expired = expired;
        this.updateDropdown();
    }

    updateWindowBounds = () => {
        this.windowBounds = this.window.getContentBounds();
        this.updateDropdown();
    }

    updateDropdown = () => {
        this.view.webContents.send(
            UPDATE_TEAMS_DROPDOWN,
            this.teams,
            this.activeTeam,
            this.darkMode,
            this.enableServerManagement,
            this.hasGPOTeams,
            this.expired,
            this.mentions,
            this.unreads,
            this.windowBounds,
        );
    }

    handleOpen = () => {
        if (!this.bounds) {
            return;
        }
        this.view.setBounds(this.bounds);
        this.window.setTopBrowserView(this.view);
        this.view.webContents.focus();
        WindowManager.sendToRenderer(OPEN_TEAMS_DROPDOWN);
        this.isOpen = true;
    }

    handleClose = () => {
        this.view.setBounds(this.getBounds(0, 0));
        WindowManager.sendToRenderer(CLOSE_TEAMS_DROPDOWN);
        this.isOpen = false;
    }

    handleReceivedMenuSize = (event: IpcMainEvent, width: number, height: number) => {
        this.bounds = this.getBounds(width, height);
        if (this.isOpen) {
            this.view.setBounds(this.bounds);
        }
    }

    getBounds = (width: number, height: number) => {
        return {
            x: (process.platform === 'darwin' ? THREE_DOT_MENU_WIDTH_MAC : THREE_DOT_MENU_WIDTH) - MENU_SHADOW_WIDTH,
            y: TAB_BAR_HEIGHT - MENU_SHADOW_WIDTH,
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
