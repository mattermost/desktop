// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent, WebContents} from 'electron';
import {ipcMain, nativeTheme} from 'electron';

import type {Theme} from '@mattermost/desktop-api';

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
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {isLightColor} from 'main/utils';

import type {CombinedConfig} from 'types/config';

export class ThemeManager {
    private mainWindowViews: Set<WebContents>;
    private popoutViews: Map<string, Set<WebContents>>;
    private popoutThemes: Map<string, Theme>;

    constructor() {
        this.mainWindowViews = new Set();
        this.popoutViews = new Map();
        this.popoutThemes = new Map();

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

    registerPopoutView = (webContents: WebContents, viewId: string) => {
        if (!this.popoutViews.has(viewId)) {
            this.popoutViews.set(viewId, new Set());
        }
        this.popoutViews.get(viewId)?.add(webContents);
        webContents.on('destroyed', () => {
            this.popoutViews.get(viewId)?.delete(webContents);
        });
    };

    updatePopoutTheme = (viewId: string, theme: Theme) => {
        this.popoutThemes.set(viewId, theme);
        this.updatePopoutViews(viewId);
    };

    private handleEmitConfiguration = (event: IpcMainEvent, config: CombinedConfig) => {
        if (Config.themeSyncing) {
            ServerManager.getAllServers().forEach((server) => {
                this.handleServerThemeChanged(server.id);
            });
        } else {
            this.resetThemeSource();
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
        const views = ViewManager.getViewsByServerId(serverId).filter((view) => view.type === ViewType.WINDOW);
        views.forEach((view) => {
            this.updatePopoutViews(view.id);
        });
    };

    private updateMainViews = () => {
        const serverId = ServerManager.getCurrentServerId();
        if (!serverId) {
            this.resetThemeSource();
            this.mainWindowViews.forEach((view) => {
                view.send(RESET_THEME);
            });
            return;
        }
        const server = ServerManager.getServer(serverId);
        if (!server || !server.theme) {
            this.resetThemeSource();
            this.mainWindowViews.forEach((view) => {
                view.send(RESET_THEME);
            });
            return;
        }
        if (!server.theme.isUsingSystemTheme) {
            const themeSource = isLightColor(server.theme.centerChannelBg) ? 'light' : 'dark';
            if (nativeTheme.themeSource !== themeSource) {
                nativeTheme.themeSource = themeSource;
            }
        }
        this.mainWindowViews.forEach((view) => {
            view.send(UPDATE_THEME, server.theme);
        });
    };

    private updatePopoutViews = (viewId: string) => {
        const popoutViews = this.popoutViews.get(viewId);
        if (popoutViews) {
            let theme = this.popoutThemes.get(viewId);
            if (!theme) {
                theme = ServerManager.getServer(viewId)?.theme;
            }
            if (!theme) {
                popoutViews.forEach((view) => {
                    view.send(RESET_THEME);
                });
                return;
            }
            popoutViews.forEach((view) => {
                view.send(UPDATE_THEME, theme);
            });
        }
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

    private resetThemeSource = () => {
        if (nativeTheme.themeSource !== 'system') {
            nativeTheme.themeSource = 'system';
        }
    };
}

const themeManager = new ThemeManager();
export default themeManager;
