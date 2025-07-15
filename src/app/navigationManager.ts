// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent} from 'electron';
import {ipcMain} from 'electron';

import ServerHub from 'app/serverHub';
import TabManager from 'app/tabs/tabManager';
import {BROWSER_HISTORY_PUSH, HISTORY, LOAD_FAILED, LOAD_SUCCESS, REQUEST_BROWSER_HISTORY_STATUS} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {getFormattedPathName, parseURL} from 'common/utils/url';
import Utils from 'common/utils/util';
import ViewManager from 'common/views/viewManager';
import {handleWelcomeScreenModal} from 'main/app/intercom';
import ModalManager from 'main/views/modalManager';
import WebContentsManager from 'main/views/viewManager';

const log = new Logger('DeepLinking');

export class NavigationManager {
    constructor() {
        ipcMain.handle(REQUEST_BROWSER_HISTORY_STATUS, this.handleRequestBrowserHistoryStatus);
        ipcMain.on(HISTORY, this.handleHistory);
        ipcMain.on(BROWSER_HISTORY_PUSH, this.handleBrowserHistoryPush);
    }

    openLinkInPrimaryTab = (url: string | URL) => {
        if (url) {
            const parsedURL = parseURL(url)!;
            const server = ServerManager.lookupServerByURL(parsedURL, true);
            if (server) {
                const primaryView = ViewManager.getPrimaryView(server.id);
                if (!primaryView) {
                    log.error(`Couldn't find a primary view for the server ${server.id}`);
                    return;
                }
                const webContentsView = WebContentsManager.getView(primaryView.id);
                if (!server || !webContentsView) {
                    log.error(`Couldn't find a server for the view ${primaryView.id}`);
                    return;
                }
                const urlWithSchema = `${server.url.origin}${getFormattedPathName(parsedURL.pathname)}${parsedURL.search}`;
                if (webContentsView.isReady() && ServerManager.getRemoteInfo(webContentsView.view.serverId)?.serverVersion && Utils.isVersionGreaterThanOrEqualTo(ServerManager.getRemoteInfo(webContentsView.view.serverId)?.serverVersion ?? '', '6.0.0')) {
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
        }
    };

    private handleBrowserHistoryPush = (e: IpcMainEvent, pathName: string) => {
        log.debug('handleBrowserHistoryPush', e.sender.id, pathName);

        const currentView = WebContentsManager.getViewByWebContentsId(e.sender.id);
        if (!currentView) {
            return;
        }

        const server = ServerManager.getServer(currentView.view.serverId);
        if (!server) {
            return;
        }

        let cleanedPathName = pathName;
        if (server.url.pathname !== '/' && pathName.startsWith(server.url.pathname)) {
            cleanedPathName = pathName.replace(server.url.pathname, '');
        }

        currentView.sendToRenderer(BROWSER_HISTORY_PUSH, cleanedPathName);
        currentView.updateHistoryButton();
    };

    private handleRequestBrowserHistoryStatus = (e: IpcMainInvokeEvent) => {
        log.silly('handleRequestBrowserHistoryStatus', e.sender.id);
        return WebContentsManager.getViewByWebContentsId(e.sender.id)?.getBrowserHistoryStatus();
    };

    private handleHistory = (event: IpcMainEvent, offset: number) => {
        WebContentsManager.getViewByWebContentsId(event.sender.id)?.goToOffset(offset);
    };

    private deeplinkSuccess = (viewId: string) => {
        ViewManager.getViewLog(viewId).debug('deeplinkSuccess');
        TabManager.switchToTab(viewId);
        const view = WebContentsManager.getView(viewId);
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
