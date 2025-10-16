// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent} from 'electron';
import {ipcMain, nativeTheme, session, shell} from 'electron';
import isDev from 'electron-is-dev';

import type {Theme} from '@mattermost/desktop-api';

import popoutMenu from 'app/popoutMenu';
import WebContentsEventManager from 'app/views/webContentEvents';
import type BaseWindow from 'app/windows/baseWindow';
import AppState from 'common/appState';
import {
    UPDATE_TARGET_URL,
    REACT_APP_INITIALIZED,
    OPEN_SERVER_UPGRADE_LINK,
    OPEN_CHANGELOG_LINK,
    GET_VIEW_INFO_FOR_TEST,
    SESSION_EXPIRED,
    GET_IS_DEV_MODE,
    UNREADS_AND_MENTIONS,
    TAB_LOGIN_CHANGED,
    SERVER_URL_CHANGED,
    OPEN_SERVER_EXTERNALLY,
    OPEN_POPOUT_MENU,
    UPDATE_SERVER_THEME,
    DARK_MODE_CHANGE,
    UPDATE_THEME,
} from 'common/communication';
import Config from 'common/config';
import {DEFAULT_CHANGELOG_LINK} from 'common/constants';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {ViewType, type MattermostView} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {flushCookiesStore} from 'main/app/utils';
import PermissionsManager from 'main/security/permissionsManager';
import ThemeManager from 'main/themeManager';

import {MattermostWebContentsView} from './MattermostWebContentsView';

const log = new Logger('WebContentsManager');

export class WebContentsManager {
    private webContentsViews: Map<string, MattermostWebContentsView>;
    private webContentsIdToView: Map<number, MattermostWebContentsView>;
    private focusedWebContentsView?: string;

    constructor() {
        this.webContentsViews = new Map();
        this.webContentsIdToView = new Map();

        ipcMain.handle(GET_VIEW_INFO_FOR_TEST, this.handleGetViewInfoForTest);
        ipcMain.handle(GET_IS_DEV_MODE, () => isDev);
        ipcMain.on(REACT_APP_INITIALIZED, this.handleReactAppInitialized);
        ipcMain.on(TAB_LOGIN_CHANGED, this.handleTabLoginChanged);

        ipcMain.on(OPEN_SERVER_EXTERNALLY, this.handleOpenServerExternally);
        ipcMain.on(OPEN_SERVER_UPGRADE_LINK, this.handleOpenServerUpgradeLink);
        ipcMain.on(OPEN_CHANGELOG_LINK, this.handleOpenChangelogLink);
        ipcMain.on(UNREADS_AND_MENTIONS, this.handleUnreadsAndMentionsChanged);
        ipcMain.on(SESSION_EXPIRED, this.handleSessionExpired);
        ipcMain.on(OPEN_POPOUT_MENU, this.handleOpenPopoutMenu);
        ipcMain.on(UPDATE_SERVER_THEME, this.handleUpdateServerTheme);
        ipcMain.on(UPDATE_THEME, this.handleUpdateTheme);

        if (process.platform !== 'linux') {
            nativeTheme.on('updated', this.handleDarkModeChanged);
        }

        ServerManager.on(SERVER_URL_CHANGED, this.handleServerURLChanged);
    }

    private handleServerURLChanged = (serverId: string) => {
        const view = this.getView(serverId);
        if (view) {
            view.reload(view.currentURL);
        }
    };

    getView = (id: string) => {
        return this.webContentsViews.get(id);
    };

    getViewByWebContentsId = (webContentsId: number) => {
        return this.webContentsIdToView.get(webContentsId);
    };

    getFocusedView = (): MattermostWebContentsView | undefined => {
        if (!this.focusedWebContentsView) {
            return undefined;
        }
        return this.webContentsViews.get(this.focusedWebContentsView);
    };

    sendToAllViews = (channel: string, ...args: unknown[]) => {
        this.webContentsViews.forEach((view) => {
            if (!view.isDestroyed()) {
                view.sendToRenderer(channel, ...args);
            }
        });
    };

    createView = (view: MattermostView, parentWindow: BaseWindow): MattermostWebContentsView => {
        const webContentsView = new MattermostWebContentsView(view, {webPreferences: {spellcheck: Config.useSpellChecker}}, parentWindow.browserWindow);
        webContentsView.on(UPDATE_TARGET_URL, (url) => parentWindow.showURLView(url));
        webContentsView.getWebContentsView().webContents.on('focus', () => {
            this.focusedWebContentsView = view.id;
        });
        webContentsView.getWebContentsView().webContents.on('blur', () => {
            this.focusedWebContentsView = undefined;
        });
        webContentsView.load(view.getLoadingURL());

        this.addViewToMap(webContentsView);
        WebContentsEventManager.addWebContentsEventListeners(webContentsView.getWebContentsView().webContents);
        return webContentsView;
    };

    removeView = (viewId: string) => {
        const view = this.webContentsViews.get(viewId);
        if (!view) {
            return;
        }

        // Destroy the view and remove it from both managers
        view.destroy();
        this.webContentsViews.delete(viewId);
        this.webContentsIdToView.delete(view.webContentsId);
    };

    clearCacheAndReloadView = (viewId: string) => {
        session.defaultSession.clearCache();
        const view = this.getView(viewId);
        view?.reload(view.currentURL);
    };

    private addViewToMap = (view: MattermostWebContentsView): void => {
        log.debug('addViewToMap', {viewId: view.id, webContentsId: view.webContentsId});

        this.webContentsViews.set(view.id, view);
        this.webContentsIdToView.set(view.webContentsId, view);

        if (ViewManager.isPrimaryView(view.id)) {
            const server = ServerManager.getServer(view.serverId);
            if (!server) {
                return;
            }
            const notificationPermission = PermissionsManager.getForServer(server)?.notifications;
            if (!notificationPermission || (!notificationPermission.allowed && notificationPermission.alwaysDeny !== true)) {
                PermissionsManager.doPermissionRequest(
                    view.webContentsId,
                    'notifications',
                    {
                        requestingUrl: server.url.toString(),
                        isMainFrame: false,
                    },
                );
            }
        }
    };

    getServerURLByViewId = (viewId: string) => {
        const view = ViewManager.getView(viewId);
        if (!view) {
            return undefined;
        }
        const server = ServerManager.getServer(view.serverId);
        if (!server) {
            return undefined;
        }
        return server.url;
    };

    private handleTabLoginChanged = (event: IpcMainEvent, loggedIn: boolean) => {
        log.debug('handleTabLoggedIn', {webContentsId: event.sender.id});
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return;
        }
        this.setLoggedIn(view, loggedIn);
    };

    private setLoggedIn = (view: MattermostWebContentsView, loggedIn: boolean) => {
        ServerManager.setLoggedIn(view.serverId, loggedIn);
        if (!loggedIn) {
            const primaryView = ViewManager.getPrimaryView(view.serverId);
            if (primaryView) {
                const server = ServerManager.getServer(primaryView.serverId);
                if (server) {
                    ViewManager.updateViewTitle(primaryView.id, undefined, undefined);
                }
            }
        }

        flushCookiesStore();
    };

    private handleReactAppInitialized = (e: IpcMainEvent) => {
        log.debug('handleReactAppInitialized', {webContentsId: e.sender.id});

        const view = this.getViewByWebContentsId(e.sender.id);
        if (view) {
            view.setInitialized();
        }
    };

    private handleOpenServerExternally = () => {
        log.debug('handleOpenServerExternally');

        const server = ServerManager.getCurrentServerId();
        if (!server) {
            return;
        }
        const serverURL = ServerManager.getServer(server)?.url.toString();
        if (!serverURL) {
            return;
        }
        shell.openExternal(serverURL);
    };

    private handleOpenServerUpgradeLink = () => {
        if (Config.upgradeLink) {
            shell.openExternal(Config.upgradeLink);
        }
    };

    private handleOpenChangelogLink = () => {
        shell.openExternal(DEFAULT_CHANGELOG_LINK);
    };

    private handleUnreadsAndMentionsChanged = (e: IpcMainEvent, isUnread: boolean, mentionCount: number) => {
        log.silly('handleUnreadsAndMentionsChanged', {webContentsId: e.sender.id, isUnread, mentionCount});

        const view = this.getViewByWebContentsId(e.sender.id);
        if (!view) {
            return;
        }

        if (!ViewManager.isPrimaryView(view.id)) {
            return;
        }

        AppState.updateUnreadsPerServer(view.serverId, isUnread);
        AppState.updateMentionsPerServer(view.serverId, mentionCount);
    };

    private handleSessionExpired = (event: IpcMainEvent, isExpired: boolean) => {
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return;
        }
        ViewManager.getViewLog(view.id).debug('handleSessionExpired', isExpired);

        if (isExpired) {
            this.setLoggedIn(view, false);
        }

        AppState.updateExpired(view.serverId, isExpired);
    };

    private handleGetViewInfoForTest = (event: IpcMainInvokeEvent) => {
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return null;
        }
        const server = ServerManager.getServer(view.serverId);
        if (!server) {
            return null;
        }
        return {
            id: view.id,
            webContentsId: view.webContentsId,
            serverName: server.name,
        };
    };

    private handleOpenPopoutMenu = (_: IpcMainEvent, viewId: string) => {
        log.debug('handleOpenPopoutMenu', {viewId});

        popoutMenu(viewId);
    };

    private handleUpdateServerTheme = (event: IpcMainEvent, theme: Theme) => {
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return;
        }
        if (ViewManager.getView(view.id)?.type === ViewType.WINDOW) {
            return;
        }
        ServerManager.updateTheme(view.serverId, theme);
    };

    private handleUpdateTheme = (event: IpcMainEvent, theme: Theme) => {
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return;
        }
        const viewType = ViewManager.getView(view.id)?.type;
        if (viewType === ViewType.WINDOW) {
            ThemeManager.updatePopoutTheme(view.id, theme);
        } else {
            ServerManager.updateTheme(view.serverId, theme);
        }
    };

    private handleDarkModeChanged = () => {
        this.sendToAllViews(DARK_MODE_CHANGE, nativeTheme.shouldUseDarkColors);
    };
}

const webContentsManager = new WebContentsManager();
export default webContentsManager;
