// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent} from 'electron';
import {ipcMain, shell} from 'electron';
import isDev from 'electron-is-dev';

import URLView from 'app/urlView';
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

    //DEVELOPER_MODE_UPDATED,
    SERVER_URL_CHANGED,
} from 'common/communication';
import Config from 'common/config';
import {DEFAULT_CHANGELOG_LINK} from 'common/constants';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import type {MattermostView} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {flushCookiesStore} from 'main/app/utils';
import PermissionsManager from 'main/permissionsManager';

//import MainWindow from 'main/windows/mainWindow';

//import type {DeveloperSettings} from 'types/settings';

import {MattermostWebContentsView} from './MattermostWebContentsView';

const log = new Logger('WebContentsManager');

export class WebContentsManager {
    private webContentsViews: Map<string, MattermostWebContentsView>;
    private webContentsIdToView: Map<number, MattermostWebContentsView>;

    constructor() {
        this.webContentsViews = new Map();
        this.webContentsIdToView = new Map();

        ipcMain.handle(GET_VIEW_INFO_FOR_TEST, this.handleGetViewInfoForTest);
        ipcMain.handle(GET_IS_DEV_MODE, () => isDev);
        ipcMain.on(REACT_APP_INITIALIZED, this.handleReactAppInitialized);
        ipcMain.on(TAB_LOGIN_CHANGED, this.handleTabLoginChanged);

        //ipcMain.on(OPEN_SERVER_EXTERNALLY, this.handleOpenServerExternally);
        ipcMain.on(OPEN_SERVER_UPGRADE_LINK, this.handleOpenServerUpgradeLink);
        ipcMain.on(OPEN_CHANGELOG_LINK, this.handleOpenChangelogLink);
        ipcMain.on(UNREADS_AND_MENTIONS, this.handleUnreadsAndMentionsChanged);
        ipcMain.on(SESSION_EXPIRED, this.handleSessionExpired);

        //DeveloperMode.on(DEVELOPER_MODE_UPDATED, this.handleDeveloperModeUpdated);

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

    reloadView = (viewId: string) => {
        const view = this.getView(viewId);
        if (view) {
            view.reload(view.currentURL);
        }
    };

    sendToAllViews = (channel: string, ...args: unknown[]) => {
        this.webContentsViews.forEach((view) => {
            if (!view.isDestroyed()) {
                view.sendToRenderer(channel, ...args);
            }
        });
    };

    createView = (view: MattermostView): MattermostWebContentsView => {
        const webContentsView = new MattermostWebContentsView(view, {webPreferences: {spellcheck: Config.useSpellChecker}});
        webContentsView.on(UPDATE_TARGET_URL, URLView.show);
        webContentsView.load(view.getLoadingURL());

        this.addViewToMap(webContentsView);
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

    private addViewToMap = (view: MattermostWebContentsView): void => {
        this.webContentsViews.set(view.id, view);
        this.webContentsIdToView.set(view.webContentsId, view);

        if (ViewManager.isPrimaryView(view.id)) {
            const server = ServerManager.getServer(view.view.serverId);
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

    // // TODO: Init code
    // private handleDeveloperModeUpdated = (json: DeveloperSettings) => {
    //     log.debug('handleDeveloperModeUpdated', json);

    //     if (['browserOnly', 'disableContextMenu'].some((key) => Object.hasOwn(json, key))) {
    //         this.webContentsViews.forEach((view) => view.destroy());
    //         this.webContentsViews = new Map();
    //         this.webContentsIdToView = new Map();
    //         this.init();
    //     }
    // };

    // TODO: Only for primary view?
    private handleTabLoginChanged = (event: IpcMainEvent, loggedIn: boolean) => {
        log.debug('handleTabLoggedIn', event.sender.id);
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return;
        }

        [...this.webContentsViews.values()].
            filter((v) => v.view.serverId === view.view.serverId).
            forEach((v) => v.onLogin(loggedIn));

        if (!loggedIn) {
            AppState.clear(view.id);
        }
        flushCookiesStore();
    };

    // TODO: Loading screen shouldn't be a singleton, should be per window
    private handleReactAppInitialized = (e: IpcMainEvent) => {
        log.debug('handleReactAppInitialized', e.sender.id);

        const view = this.getViewByWebContentsId(e.sender.id);
        if (view) {
            view.setInitialized();
        }
    };

    // private handleOpenServerExternally = () => {
    //     log.debug('handleOpenServerExternally');

    //     const view = this.getCurrentView();
    //     if (!view) {
    //         return;
    //     }
    //     shell.openExternal(view.server.url.toString());
    // };

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

        AppState.updateUnreads(view.id, isUnread);
        AppState.updateMentions(view.id, mentionCount);
    };

    private handleSessionExpired = (event: IpcMainEvent, isExpired: boolean) => {
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return;
        }
        ViewManager.getViewLog(view.id).debug('handleSessionExpired', isExpired);

        AppState.updateExpired(view.id, isExpired);
    };

    private handleGetViewInfoForTest = (event: IpcMainInvokeEvent) => {
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return null;
        }
        const server = ServerManager.getServer(view.view.serverId);
        if (!server) {
            return null;
        }
        return {
            id: view.id,
            webContentsId: view.webContentsId,
            serverName: server.name,
        };
    };
}

const webContentsManager = new WebContentsManager();
export default webContentsManager;
