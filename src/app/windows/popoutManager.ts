// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WebContentsView} from 'electron';
import {ipcMain} from 'electron';

import WebContentsManager from 'app/views/webContentsManager';
import BaseWindow from 'app/windows/baseWindow';
import {CREATE_NEW_WINDOW, LOAD_FAILED, LOADSCREEN_END, RELOAD_VIEW, UPDATE_TAB_TITLE, VIEW_CREATED, VIEW_REMOVED, VIEW_UPDATED} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import performanceMonitor from 'main/performanceMonitor';
import {getWindowBoundaries} from 'main/utils';

const log = new Logger('PopoutManager');

export class PopoutManager {
    private popoutWindows: Map<string, BaseWindow>;

    constructor() {
        this.popoutWindows = new Map();

        ipcMain.handle(CREATE_NEW_WINDOW, (event, serverId) => this.handleCreateNewWindow(serverId));

        ViewManager.on(VIEW_CREATED, this.handleViewCreated);
        ViewManager.on(VIEW_REMOVED, this.handleViewRemoved);
        ViewManager.on(VIEW_UPDATED, this.handleViewUpdated);
    }

    createNewWindow = (serverId: string) => {
        this.handleCreateNewWindow(serverId);
    };

    getWindow = (viewId: string) => {
        return this.popoutWindows.get(viewId);
    };

    getViewIdByWindowWebContentsId = (webContentsId: number) => {
        return [...this.popoutWindows.keys()].find((id) => this.popoutWindows.get(id)?.browserWindow?.webContents.id === webContentsId);
    };

    private handleViewCreated = (viewId: string) => {
        log.debug('handleViewCreated', viewId);

        const view = ViewManager.getView(viewId);
        if (view && view.type === ViewType.WINDOW) {
            const window = new BaseWindow({});
            const localURL = 'mattermost-desktop://renderer/popout.html';
            performanceMonitor.registerView(`PopoutWindow-${viewId}`, window.browserWindow.webContents);
            window.browserWindow.loadURL(localURL).catch(
                (reason) => {
                    log.error('failed to load', reason);
                });

            this.popoutWindows.set(viewId, window);

            const webContentsView = WebContentsManager.createView(view, window);
            webContentsView.on(LOADSCREEN_END, () => window.fadeLoadingScreen());
            webContentsView.on(LOAD_FAILED, this.onPopoutLoadFailed(window, webContentsView.getWebContentsView()));
            webContentsView.on(RELOAD_VIEW, () => window.showLoadingScreen());
            window.browserWindow.contentView.on('bounds-changed', this.setBounds(window, webContentsView.getWebContentsView()));
            window.browserWindow.on('focus', () => webContentsView.getWebContentsView().webContents.focus());
            window.browserWindow.once('show', this.setBounds(window, webContentsView.getWebContentsView()));

            window.browserWindow.contentView.addChildView(webContentsView.getWebContentsView());
            if (webContentsView.needsLoadingScreen()) {
                window.showLoadingScreen();
            }

            window.browserWindow.show();
        }
    };

    private onPopoutLoadFailed = (window: BaseWindow, webContentsView: WebContentsView) => {
        return () => {
            window.browserWindow?.contentView.removeChildView(webContentsView);
            window.fadeLoadingScreen();
        };
    };

    private setBounds = (window: BaseWindow, webContentsView: WebContentsView) => {
        return () => {
            if (window.browserWindow) {
                webContentsView.setBounds(getWindowBoundaries(window.browserWindow));
            }
        };
    };

    private handleViewUpdated = (viewId: string) => {
        log.debug('handleViewUpdated', viewId);

        const view = ViewManager.getView(viewId);
        if (view && view.type === ViewType.WINDOW) {
            const window = this.popoutWindows.get(viewId);
            if (window) {
                const server = ServerManager.getServer(view.serverId);
                const title = `${server?.name} - ${view.title}`;
                window.browserWindow.setTitle(title);
                window.browserWindow.webContents.send(UPDATE_TAB_TITLE, view.id, title);
            }
        }
    };

    private handleViewRemoved = (viewId: string) => {
        log.debug('handleViewRemoved', viewId);

        const window = this.popoutWindows.get(viewId);
        if (window) {
            WebContentsManager.removeView(viewId);
            window.browserWindow?.close();
            this.popoutWindows.delete(viewId);
        }
    };

    private handleCreateNewWindow = (serverId: string) => {
        log.debug('handleCreateNewTab', serverId);

        const server = ServerManager.getServer(serverId);
        if (!server) {
            return undefined;
        }

        return ViewManager.createView(server, ViewType.WINDOW).id;
    };
}

const popoutManager = new PopoutManager();
export default popoutManager;
