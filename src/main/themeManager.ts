// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent, WebContents} from 'electron';
import {ipcMain, nativeTheme} from 'electron';

import {
    DARK_MODE_CHANGE,
    EMIT_CONFIGURATION,
    GET_THEME,
    RESET_THEME,
    SERVER_SWITCHED,
    SERVER_THEME_CHANGED,
    UPDATE_THEME,
} from 'common/communication';
import Config from 'common/config';
import ServerManager from 'common/servers/serverManager';
import {isLightColor} from 'main/utils';

import type {CombinedConfig} from 'types/config';

export class ThemeManager {
    private mainWindowViews: Set<WebContents>;
    private popoutViews: Map<string, Set<WebContents>>;

    constructor() {
        this.mainWindowViews = new Set();
        this.popoutViews = new Map();

        ipcMain.on(EMIT_CONFIGURATION, this.handleEmitConfiguration);
        ipcMain.handle(GET_THEME, this.handleGetTheme);

        ServerManager.on(SERVER_THEME_CHANGED, this.handleServerThemeChanged);
        ServerManager.on(SERVER_SWITCHED, this.updateMainViews);
    }

    registerMainWindowView = (webContents: WebContents) => {
        this.mainWindowViews.add(webContents);
        webContents.on('destroyed', () => {
            this.mainWindowViews.delete(webContents);
        });
    };

    registerPopoutView = (webContents: WebContents, serverId: string) => {
        if (!this.popoutViews.has(serverId)) {
            this.popoutViews.set(serverId, new Set());
        }
        this.popoutViews.get(serverId)?.add(webContents);
        webContents.on('destroyed', () => {
            this.popoutViews.get(serverId)?.delete(webContents);
        });
    };

    private handleEmitConfiguration = (event: IpcMainEvent, config: CombinedConfig) => {
        if (Config.themeSyncing) {
            ServerManager.getAllServers().forEach((server) => {
                this.handleServerThemeChanged(server.id);
            });
        } else {
            if (nativeTheme.themeSource !== 'system') {
                nativeTheme.themeSource = 'system';
            }
            this.mainWindowViews.forEach((view) => {
                view.send(RESET_THEME);
            });
            this.popoutViews.forEach((views) => {
                views.forEach((view) => {
                    view.send(RESET_THEME);
                });
            });
        }

        this.mainWindowViews.forEach((view) => {
            view.send(DARK_MODE_CHANGE, config.darkMode);
        });
        this.popoutViews.forEach((views) => {
            views.forEach((view) => {
                view.send(DARK_MODE_CHANGE, config.darkMode);
            });
        });
    };

    private handleServerThemeChanged = (serverId: string) => {
        if (!Config.themeSyncing) {
            return;
        }

        this.updateMainViews();

        const popoutViews = this.popoutViews.get(serverId);
        if (popoutViews) {
            const server = ServerManager.getServer(serverId);
            if (!server || !server.theme) {
                popoutViews.forEach((view) => {
                    view.send(RESET_THEME);
                });
                return;
            }
            popoutViews.forEach((view) => {
                view.send(UPDATE_THEME, server.theme);
            });
        }
    };

    private updateMainViews = () => {
        const serverId = ServerManager.getCurrentServerId();
        if (!serverId) {
            nativeTheme.themeSource = 'system';
            this.mainWindowViews.forEach((view) => {
                view.send(RESET_THEME);
            });
            return;
        }
        const server = ServerManager.getServer(serverId);
        if (!server || !server.theme) {
            nativeTheme.themeSource = 'system';
            this.mainWindowViews.forEach((view) => {
                view.send(RESET_THEME);
            });
            return;
        }
        if (!server.theme.isUsingSystemTheme) {
            nativeTheme.themeSource = isLightColor(server.theme.centerChannelBg) ? 'light' : 'dark';
        }
        this.mainWindowViews.forEach((view) => {
            view.send(UPDATE_THEME, server.theme);
        });
    };

    private handleGetTheme = (event: IpcMainInvokeEvent) => {
        if (!Config.themeSyncing) {
            return undefined;
        }

        let popoutServerId;
        this.popoutViews.forEach((views, serverId) => {
            if (views.has(event.sender)) {
                popoutServerId = serverId;
            }
        });
        if (popoutServerId) {
            const server = ServerManager.getServer(popoutServerId);
            if (!server) {
                return undefined;
            }
            return server.theme;
        }

        const serverId = ServerManager.getCurrentServerId();
        if (!serverId) {
            return undefined;
        }
        const server = ServerManager.getServer(serverId);
        if (!server) {
            return undefined;
        }
        return server.theme;
    };
}

const themeManager = new ThemeManager();
export default themeManager;
