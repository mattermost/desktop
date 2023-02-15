// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, BrowserWindow, ipcMain, IpcMainEvent} from 'electron';

import log from 'electron-log';

import {CombinedConfig, Team, TeamWithTabs, TeamWithTabsAndGpo} from 'types/config';

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
import WindowManager from '../windows/windowManager';

export default class TeamDropdownView {
    view: BrowserView;
    bounds?: Electron.Rectangle;
    teams: TeamWithTabsAndGpo[];
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
        this.teams = this.addGpoToTeams(teams, []);
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
    }

    updateConfig = (event: IpcMainEvent, config: CombinedConfig) => {
        log.silly('TeamDropdownView.config', {config});

        this.teams = this.addGpoToTeams(config.teams, config.registryTeams);
        this.darkMode = config.darkMode;
        this.enableServerManagement = config.enableServerManagement;
        this.hasGPOTeams = config.registryTeams && config.registryTeams.length > 0;
        this.updateDropdown();
    }

    updateActiveTeam = (event: IpcMainEvent, name: string) => {
        log.silly('TeamDropdownView.updateActiveTeam', {name});

        this.activeTeam = name;
        this.updateDropdown();
    }

    updateMentions = (expired: Map<string, boolean>, mentions: Map<string, number>, unreads: Map<string, boolean>) => {
        log.silly('TeamDropdownView.updateMentions', {expired, mentions, unreads});

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

    addGpoToTeams = (teams: TeamWithTabs[], registryTeams: Team[]): TeamWithTabsAndGpo[] => {
        if (!registryTeams || registryTeams.length === 0) {
            return teams.map((team) => ({...team, isGpo: false}));
        }
        return teams.map((team) => {
            return {
                ...team,
                isGpo: registryTeams.some((regTeam) => regTeam!.url === team!.url),
            };
        });
    }
}
