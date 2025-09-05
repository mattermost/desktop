// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WebContentsView} from 'electron';
import {ipcMain} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import type {MattermostWebContentsView} from 'app/views/MattermostWebContentsView';
import WebContentsManager from 'app/views/webContentsManager';
import BaseWindow from 'app/windows/baseWindow';
import {
    CREATE_NEW_WINDOW,
    LOAD_FAILED,
    LOADSCREEN_END,
    RELOAD_VIEW,
    SERVER_LOGGED_IN_CHANGED,
    UPDATE_POPOUT_TITLE,
    VIEW_CREATED,
    VIEW_REMOVED,
    VIEW_TITLE_UPDATED,
    VIEW_TYPE_ADDED,
    VIEW_TYPE_REMOVED,
} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {TAB_BAR_HEIGHT} from 'common/utils/constants';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import performanceMonitor from 'main/performanceMonitor';
import {getWindowBoundaries} from 'main/utils';

const log = new Logger('PopoutManager');

export class PopoutManager {
    private popoutWindows: Map<string, BaseWindow>;
    private popoutListeners: Map<string, () => void>;

    constructor() {
        this.popoutWindows = new Map();
        this.popoutListeners = new Map();

        ipcMain.handle(CREATE_NEW_WINDOW, (event, serverId) => this.handleCreateNewWindow(serverId));

        ViewManager.on(VIEW_CREATED, this.handleViewCreated);
        ViewManager.on(VIEW_REMOVED, this.handleViewRemoved);
        ViewManager.on(VIEW_TITLE_UPDATED, this.handleViewUpdated);
        ViewManager.on(VIEW_TYPE_REMOVED, this.handleViewTypeRemoved);
        ViewManager.on(VIEW_TYPE_ADDED, this.handleViewTypeAdded);

        ServerManager.on(SERVER_LOGGED_IN_CHANGED, this.handleServerLoggedInChanged);
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
            const window = this.createPopoutWindow(viewId);
            const mattermostWebContentsView = WebContentsManager.createView(view, window);
            this.setupView(viewId, window, mattermostWebContentsView);

            if (mattermostWebContentsView.needsLoadingScreen()) {
                window.showLoadingScreen();
            }

            this.startPopoutWindow(viewId, window);
        }
    };

    private createPopoutWindow = (viewId: string) => {
        let options = {};
        const mainWindow = MainWindow.get();
        if (mainWindow) {
            options = {
                x: mainWindow.getPosition()[0] + TAB_BAR_HEIGHT,
                y: mainWindow.getPosition()[1] + TAB_BAR_HEIGHT,
            };
        }
        const window = new BaseWindow(options);
        performanceMonitor.registerView(`PopoutWindow-${viewId}`, window.browserWindow.webContents);
        this.popoutWindows.set(viewId, window);

        return window;
    };

    private startPopoutWindow = (viewId: string, window: BaseWindow) => {
        window.browserWindow.webContents.once('did-finish-load', () => {
            this.handleViewUpdated(viewId);
            window.browserWindow.show();
        });
        window.browserWindow.loadURL('mattermost-desktop://renderer/popout.html').catch(
            (reason) => {
                log.error('failed to load', reason);
            });
    };

    private setupView = (viewId: string, window: BaseWindow, mattermostWebContentsView: MattermostWebContentsView) => {
        const webContentsView = mattermostWebContentsView.getWebContentsView();

        const loadScreenEnd = () => window.fadeLoadingScreen();
        const loadFailed = this.onPopoutLoadFailed(window, webContentsView);
        const reloadView = () => window.showLoadingScreen();
        const focus = () => mattermostWebContentsView.focus();
        const setBounds = this.setBounds(window, webContentsView);
        const close = () => ViewManager.removeView(viewId);

        mattermostWebContentsView.on(LOADSCREEN_END, loadScreenEnd);
        mattermostWebContentsView.on(LOAD_FAILED, loadFailed);
        mattermostWebContentsView.on(RELOAD_VIEW, reloadView);
        window.browserWindow.on('focus', focus);
        window.browserWindow.contentView.on('bounds-changed', setBounds);
        window.browserWindow.once('show', setBounds);
        window.browserWindow.once('close', close);

        if (process.platform !== 'darwin') {
            // @ts-expect-error: The type is wrong on Electrons side
            webContentsView.webContents.on('before-input-event', window.handleAltKeyPressed);
        }

        this.popoutListeners.set(viewId, () => {
            mattermostWebContentsView.off(LOADSCREEN_END, loadScreenEnd);
            mattermostWebContentsView.off(LOAD_FAILED, loadFailed);
            mattermostWebContentsView.off(RELOAD_VIEW, reloadView);
            window.browserWindow.off('focus', focus);
            window.browserWindow.contentView.off('bounds-changed', setBounds);
            window.browserWindow.off('show', setBounds);
            window.browserWindow.off('close', close);

            // @ts-expect-error: The type is wrong on Electrons side
            webContentsView.webContents.off('before-input-event', window.handleAltKeyPressed);
        });

        window.browserWindow.contentView.addChildView(mattermostWebContentsView.getWebContentsView());
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
                const title = `${server?.name} - ${ViewManager.getViewTitle(viewId)}`;
                window.browserWindow.setTitle(title);
                window.browserWindow.webContents.send(UPDATE_POPOUT_TITLE, view.id, title);
            }
        }
    };

    private handleViewRemoved = (viewId: string) => {
        log.debug('handleViewRemoved', viewId);

        const window = this.popoutWindows.get(viewId);
        if (window) {
            this.popoutListeners.get(viewId)?.();
            this.popoutListeners.delete(viewId);
            WebContentsManager.removeView(viewId);
            window.browserWindow?.close();
            this.popoutWindows.delete(viewId);
        }
    };

    private handleViewTypeRemoved = (viewId: string, type: ViewType) => {
        if (type === ViewType.WINDOW) {
            this.popoutListeners.get(viewId)?.();
            this.popoutListeners.delete(viewId);
            const window = this.popoutWindows.get(viewId);
            if (window) {
                window.browserWindow?.close();
                this.popoutWindows.delete(viewId);
            }
        }
    };

    private handleViewTypeAdded = (viewId: string, type: ViewType) => {
        if (type === ViewType.WINDOW) {
            const view = ViewManager.getView(viewId);
            if (view) {
                const window = this.createPopoutWindow(viewId);
                const mattermostWebContentsView = WebContentsManager.getView(viewId);
                if (mattermostWebContentsView) {
                    mattermostWebContentsView.updateParentWindow(window.browserWindow);
                    this.setupView(viewId, window, mattermostWebContentsView);
                }
                this.startPopoutWindow(viewId, window);
            }
        }
    };

    private handleCreateNewWindow = (serverId: string) => {
        log.debug('handleCreateNewTab', serverId);

        const server = ServerManager.getServer(serverId);
        if (!server) {
            return undefined;
        }

        return ViewManager.createView(server, ViewType.WINDOW)?.id;
    };

    private handleServerLoggedInChanged = (serverId: string, loggedIn: boolean) => {
        log.debug('handleServerLoggedInChanged', serverId, loggedIn);

        if (!loggedIn) {
            // TODO: The flow I'd prefer is to disable each popout window
            // But that's not easily feasible yet, so for now we just remove them
            [...this.popoutWindows.keys()].forEach((viewId) => {
                if (ViewManager.getView(viewId)?.serverId === serverId) {
                    ViewManager.removeView(viewId);
                }
            });
        }
    };
}

const popoutManager = new PopoutManager();
export default popoutManager;
