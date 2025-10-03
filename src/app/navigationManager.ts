// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent} from 'electron';
import {dialog, ipcMain} from 'electron';

import ModalManager from 'app/mainWindow/modals/modalManager';
import ServerHub from 'app/serverHub';
import TabManager from 'app/tabs/tabManager';
import WebContentsManager from 'app/views/webContentsManager';
import {BROWSER_HISTORY_PUSH, HISTORY, LOAD_FAILED, LOAD_SUCCESS, REQUEST_BROWSER_HISTORY_STATUS} from 'common/communication';
import {Logger} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {getFormattedPathName, parseURL} from 'common/utils/url';
import Utils from 'common/utils/util';
import type {MattermostView} from 'common/views/MattermostView';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {handleWelcomeScreenModal} from 'main/app/intercom';
import {localizeMessage} from 'main/i18nManager';

const log = new Logger('DeepLinking');

export class NavigationManager {
    private ready: boolean;
    private queuedDeepLink?: string | URL;

    constructor() {
        this.ready = false;

        ipcMain.handle(REQUEST_BROWSER_HISTORY_STATUS, this.handleRequestBrowserHistoryStatus);
        ipcMain.on(HISTORY, this.handleHistory);
        ipcMain.on(BROWSER_HISTORY_PUSH, this.handleBrowserHistoryPush);
    }

    private openLinkInTab = (url: string | URL, getView: (server: MattermostServer) => MattermostView | undefined) => {
        if (!url) {
            return;
        }

        const parsedURL = parseURL(url)!;
        const server = ServerManager.lookupServerByURL(parsedURL, true);
        if (server) {
            const view = getView(server);
            if (!view) {
                return;
            }

            const webContentsView = WebContentsManager.getView(view.id);
            if (!webContentsView) {
                log.error(`Couldn't find a server for the view ${view.id}`);
                return;
            }

            const urlWithSchema = `${server.url.origin}${getFormattedPathName(parsedURL.pathname)}${parsedURL.search}`;
            if (webContentsView.isReady() && ServerManager.getRemoteInfo(webContentsView.serverId)?.serverVersion && Utils.isVersionGreaterThanOrEqualTo(ServerManager.getRemoteInfo(webContentsView.serverId)?.serverVersion ?? '', '6.0.0')) {
                const formattedServerURL = `${server.url.origin}${getFormattedPathName(server.url.pathname)}`;
                const pathName = `/${urlWithSchema.replace(formattedServerURL, '')}`;
                webContentsView.sendToRenderer(BROWSER_HISTORY_PUSH, pathName);
                this.deeplinkSuccess(webContentsView.id);
            } else {
                webContentsView.resetLoadingStatus();
                webContentsView.once(LOAD_SUCCESS, this.deeplinkSuccess);
                webContentsView.once(LOAD_FAILED, this.deeplinkFailed);
                webContentsView.load(urlWithSchema);
            }
        } else if (ServerManager.hasServers()) {
            ServerHub.showNewServerModal(`${parsedURL.host}${getFormattedPathName(parsedURL.pathname)}${parsedURL.search}`);
        } else {
            ModalManager.removeModal('welcomeScreen');
            handleWelcomeScreenModal(`${parsedURL.host}${getFormattedPathName(parsedURL.pathname)}${parsedURL.search}`);
        }
    };

    init = () => {
        this.ready = true;
        if (this.queuedDeepLink) {
            this.openLinkInPrimaryTab(this.queuedDeepLink);
            this.queuedDeepLink = undefined;
        }
    };

    openLinkInPrimaryTab = (url: string | URL) => {
        if (!this.ready) {
            this.queuedDeepLink = url;
            return;
        }

        this.openLinkInTab(url, (server: MattermostServer) => {
            let view = ViewManager.getPrimaryView(server.id);

            // We should only open in the primary tab for logging in, and if the app is just starting up
            if (!view || server.isLoggedIn) {
                view = ViewManager.createView(server, ViewType.TAB);
                if (!view) {
                    this.showViewLimitReachedError();
                    return undefined;
                }
                TabManager.switchToTab(view.id);
            }
            return view;
        });
    };

    openLinkInNewTab = (url: string | URL) => {
        this.openLinkInTab(url, (server: MattermostServer) => {
            const view = ViewManager.createView(server, ViewType.TAB);
            if (!view) {
                this.showViewLimitReachedError();
                return undefined;
            }
            TabManager.switchToTab(view.id);
            return view;
        });
    };

    openLinkInNewWindow = (url: string | URL) => {
        this.openLinkInTab(url, (server: MattermostServer) => {
            return ViewManager.createView(server, ViewType.WINDOW);
        });
    };

    private showViewLimitReachedError = () => {
        dialog.showErrorBox(
            localizeMessage('app.navigationManager.viewLimitReached', 'View limit reached'),
            localizeMessage('app.navigationManager.viewLimitReached.description', 'You have reached the maximum number of open windows and tabs for this server. Please close an existing window or tab, or adjust the view limit in the Settings modal.'),
        );
    };

    private handleBrowserHistoryPush = (e: IpcMainEvent, pathName: string) => {
        log.debug('handleBrowserHistoryPush', {webContentsId: e.sender.id});

        let currentView = WebContentsManager.getViewByWebContentsId(e.sender.id);
        if (!currentView) {
            return;
        }

        const server = ServerManager.getServer(currentView.serverId);
        if (!server) {
            return;
        }

        // We should disallow navigation to non-logged in servers from non-primary views
        if (!server?.isLoggedIn && !ViewManager.isPrimaryView(currentView.id)) {
            return;
        }

        let cleanedPathName = pathName;
        if (server.url.pathname !== '/' && pathName.startsWith(server.url.pathname)) {
            cleanedPathName = pathName.replace(server.url.pathname, '');
        }

        if (currentView.parentViewId) {
            currentView = WebContentsManager.getView(currentView.parentViewId);
        }

        currentView?.sendToRenderer(BROWSER_HISTORY_PUSH, cleanedPathName);
        currentView?.updateHistoryButton();
    };

    private handleRequestBrowserHistoryStatus = (e: IpcMainInvokeEvent) => {
        log.silly('handleRequestBrowserHistoryStatus', {webContentsId: e.sender.id});
        return WebContentsManager.getViewByWebContentsId(e.sender.id)?.getBrowserHistoryStatus();
    };

    private handleHistory = (event: IpcMainEvent, offset: number) => {
        WebContentsManager.getViewByWebContentsId(event.sender.id)?.goToOffset(offset);
    };

    private deeplinkSuccess = (viewId: string) => {
        ViewManager.getViewLog(viewId).debug('deeplinkSuccess');
        const view = WebContentsManager.getView(viewId);
        TabManager.switchToTab(viewId);
        if (view) {
            view.removeListener(LOAD_FAILED, this.deeplinkFailed);
        }
    };

    private deeplinkFailed = (viewId: string, err: string, url: string) => {
        ViewManager.getViewLog(viewId).error(`failed to load deeplink ${url}`, err);
        const view = WebContentsManager.getView(viewId);
        if (view) {
            view.removeListener(LOAD_SUCCESS, this.deeplinkSuccess);
        }
    };
}

const navigationManager = new NavigationManager();
export default navigationManager;
