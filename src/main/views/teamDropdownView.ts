// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, BrowserWindow, ipcMain, IpcMainEvent} from 'electron';
import log from 'electron-log';

import {CombinedConfig, MattermostTeam} from 'types/config';

import {
    CLOSE_TEAMS_DROPDOWN,
    EMIT_CONFIGURATION,
    OPEN_TEAMS_DROPDOWN,
    UPDATE_TEAMS_DROPDOWN,
    UPDATE_DROPDOWN_MENTIONS,
    REQUEST_TEAMS_DROPDOWN_INFO,
    RECEIVE_DROPDOWN_MENU_SIZE,
    SET_ACTIVE_VIEW,
    SERVERS_UPDATE,
} from 'common/communication';
import {TAB_BAR_HEIGHT, THREE_DOT_MENU_WIDTH, THREE_DOT_MENU_WIDTH_MAC, MENU_SHADOW_WIDTH} from 'common/utils/constants';

import ServerManager from 'common/servers/serverManager';
import {getLocalPreload, getLocalURLString} from 'main/utils';

import * as AppState from '../appState';
import WindowManager from '../windows/windowManager';

export default class TeamDropdownView {
    view: BrowserView;
    bounds?: Electron.Rectangle;
    teams: MattermostTeam[];
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

    constructor(window: BrowserWindow, darkMode: boolean, enableServerManagement: boolean) {
        this.teams = this.getOrderedTeams();
        this.hasGPOTeams = this.teams.some((srv) => srv.isPredefined);
        this.window = window;
        this.darkMode = darkMode;
        this.enableServerManagement = enableServerManagement;
        this.isOpen = false;

        this.windowBounds = this.window.getContentBounds();

        const preload = getLocalPreload('desktopAPI.js');
        this.view = new BrowserView({webPreferences: {
            preload,

            // Workaround for this issue: https://github.com/electron/electron/issues/30993
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            transparent: true,
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

        ServerManager.on(SERVERS_UPDATE, this.updateServers);
    }

    private getOrderedTeams = () => {
        return ServerManager.getOrderedServers().map((team) => team.toMattermostTeam());
    }

    updateServers = () => {
        this.teams = this.getOrderedTeams();
        this.hasGPOTeams = this.teams.some((srv) => srv.isPredefined);
    }

    updateConfig = (event: IpcMainEvent, config: CombinedConfig) => {
        log.silly('TeamDropdownView.config', {config});

        this.darkMode = config.darkMode;
        this.enableServerManagement = config.enableServerManagement;
        this.updateDropdown();
    }

    updateActiveTeam = (event: IpcMainEvent, serverId: string) => {
        log.silly('TeamDropdownView.updateActiveTeam', {serverId});

        this.activeTeam = serverId;
        this.updateDropdown();
    }

    updateMentions = (expired: Map<string, boolean>, mentions: Map<string, number>, unreads: Map<string, boolean>) => {
        log.silly('TeamDropdownView.updateMentions', {expired, mentions, unreads});

        // TODO
        // const {sessionExpired, hasUnreads, mentionCount} = team.tabs.reduce((counts, tab) => {
        //     const tabName = getTabViewName(team.name, tab.name);
        //     counts.sessionExpired = this.state.expired?.get(tabName) || counts.sessionExpired;
        //     counts.hasUnreads = this.state.unreads?.get(tabName) || counts.hasUnreads;
        //     counts.mentionCount += this.state.mentions?.get(tabName) || 0;
        //     return counts;
        // }, {sessionExpired: false, hasUnreads: false, mentionCount: 0});

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
        log.silly('TeamDropdownView.updateDropdown');

        this.view.webContents.send(
            UPDATE_TEAMS_DROPDOWN,
            this.teams,
            this.darkMode,
            this.windowBounds,
            this.activeTeam,
            this.enableServerManagement,
            this.hasGPOTeams,
            this.expired,
            this.mentions,
            this.unreads,
        );
    }

    handleOpen = () => {
        log.debug('TeamDropdownView.handleOpen');

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
        log.debug('TeamDropdownView.handleClose');

        this.view.setBounds(this.getBounds(0, 0));
        WindowManager.sendToRenderer(CLOSE_TEAMS_DROPDOWN);
        this.isOpen = false;
    }

    handleReceivedMenuSize = (event: IpcMainEvent, width: number, height: number) => {
        log.silly('TeamDropdownView.handleReceivedMenuSize', {width, height});

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
