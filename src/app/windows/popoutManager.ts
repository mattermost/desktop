// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent, WebContentsView} from 'electron';
import {ipcMain} from 'electron';

import type {PopoutViewProps} from '@mattermost/desktop-api';

import MainWindow from 'app/mainWindow/mainWindow';
import MenuManager from 'app/menus';
import type {MattermostWebContentsView} from 'app/views/MattermostWebContentsView';
import WebContentsManager from 'app/views/webContentsManager';
import BaseWindow from 'app/windows/baseWindow';
import {
    CLEAR_CACHE_AND_RELOAD,
    CREATE_NEW_WINDOW,
    LOAD_FAILED,
    LOADSCREEN_END,
    CAN_POPOUT,
    OPEN_POPOUT,
    RELOAD_VIEW,
    SERVER_LOGGED_IN_CHANGED,
    UPDATE_POPOUT_TITLE,
    VIEW_CREATED,
    VIEW_REMOVED,
    VIEW_TITLE_UPDATED,
    VIEW_TYPE_ADDED,
    VIEW_TYPE_REMOVED,
    CAN_USE_POPOUT_OPTION,
    SEND_TO_PARENT,
    MESSAGE_FROM_PARENT,
    SEND_TO_POPOUT,
    MESSAGE_FROM_POPOUT,
    POPOUT_CLOSED,
} from 'common/communication';
import {POPOUT_RATE_LIMIT} from 'common/constants';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {DEFAULT_RHS_WINDOW_WIDTH, TAB_BAR_HEIGHT} from 'common/utils/constants';
import type {MattermostView} from 'common/views/MattermostView';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import performanceMonitor from 'main/performanceMonitor';
import {getWindowBoundaries} from 'main/utils';

const log = new Logger('PopoutManager');

export class PopoutManager {
    private popoutWindows: Map<string, BaseWindow>;
    private popoutListeners: Map<string, () => void>;

    private debouncePopout: boolean;

    constructor() {
        this.popoutWindows = new Map();
        this.popoutListeners = new Map();
        this.debouncePopout = false;

        ipcMain.handle(CREATE_NEW_WINDOW, (event, serverId) => this.handleCreateNewWindow(serverId));
        ipcMain.handle(CAN_POPOUT, this.handleCanPopout);
        ipcMain.handle(OPEN_POPOUT, this.handleOpenPopout);
        ipcMain.handle(CAN_USE_POPOUT_OPTION, this.handleCanUsePopoutOption);
        ipcMain.on(SEND_TO_PARENT, this.handleSendToParent);
        ipcMain.on(SEND_TO_POPOUT, this.handleSendToPopout);
        ipcMain.on(CLEAR_CACHE_AND_RELOAD, this.handleClearCacheAndReload);

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
        log.debug('handleViewCreated', {viewId});

        const view = ViewManager.getView(viewId);
        if (view && view.type === ViewType.WINDOW) {
            const window = this.createPopoutWindow(view);
            const mattermostWebContentsView = WebContentsManager.createView(view, window);
            this.setupView(viewId, window, mattermostWebContentsView);

            if (mattermostWebContentsView.needsLoadingScreen()) {
                window.showLoadingScreen();
            }

            this.startPopoutWindow(viewId, window);
        }
    };

    private createPopoutWindow = (view: MattermostView) => {
        let options = {} as Electron.BrowserWindowConstructorOptions;
        const mainWindow = MainWindow.get();
        if (mainWindow) {
            options = {
                x: mainWindow.getPosition()[0] + TAB_BAR_HEIGHT,
                y: mainWindow.getPosition()[1] + TAB_BAR_HEIGHT,
            };
            if (view.props?.isRHS) {
                options.x = (mainWindow.getPosition()[0] + mainWindow.getSize()[0]) - DEFAULT_RHS_WINDOW_WIDTH;
                options.width = DEFAULT_RHS_WINDOW_WIDTH;
                options.height = mainWindow.getSize()[1] - TAB_BAR_HEIGHT;
            }
        }
        const window = new BaseWindow(options);
        performanceMonitor.registerView(`PopoutWindow-${view.id}`, window.browserWindow.webContents);
        this.popoutWindows.set(view.id, window);

        return window;
    };

    private startPopoutWindow = (viewId: string, window: BaseWindow) => {
        window.browserWindow.webContents.once('did-finish-load', () => {
            this.handleViewUpdated(viewId);
            window.browserWindow.show();
        });
        window.browserWindow.loadURL('mattermost-desktop://renderer/popout.html').catch(
            (reason) => {
                log.error('failed to load', {reason});
            });
    };

    private setupView = (viewId: string, window: BaseWindow, mattermostWebContentsView: MattermostWebContentsView) => {
        const webContentsView = mattermostWebContentsView.getWebContentsView();

        const loadScreenEnd = () => window.fadeLoadingScreen();
        const loadFailed = this.onPopoutLoadFailed(window, webContentsView);
        const reloadView = () => {
            window.browserWindow.contentView.addChildView(mattermostWebContentsView.getWebContentsView());
            window.showLoadingScreen();
        };
        const focus = () => {
            mattermostWebContentsView.focus();

            // TODO: Would be better encapsulated in the MenuManager
            MenuManager.refreshMenu();
        };
        const setBounds = this.setBounds(window, webContentsView);
        const close = this.onClosePopout(viewId);

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

    private onClosePopout = (viewId: string) => {
        return () => {
            const view = ViewManager.getView(viewId);
            if (view?.parentViewId) {
                const parentView = WebContentsManager.getView(view.parentViewId);
                if (parentView) {
                    parentView.sendToRenderer(POPOUT_CLOSED, view.id);
                }
            }
            ViewManager.removeView(viewId);
        };
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
        log.debug('handleViewUpdated', {viewId});

        const view = ViewManager.getView(viewId);
        if (view && view.type === ViewType.WINDOW) {
            const window = this.popoutWindows.get(viewId);
            if (window) {
                const title = ViewManager.getViewTitle(viewId);
                window.browserWindow.setTitle(title);
                window.browserWindow.webContents.send(UPDATE_POPOUT_TITLE, viewId, title);
            }
        }
    };

    private handleViewRemoved = (viewId: string) => {
        log.debug('handleViewRemoved', {viewId});

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
                const window = this.createPopoutWindow(view);
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
        log.debug('handleCreateNewTab', {serverId});

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

    private handleCanPopout = () => {
        return !ViewManager.isViewLimitReached();
    };

    private handleOpenPopout = (event: IpcMainInvokeEvent, path: string, props: PopoutViewProps) => {
        log.debug('handleOpenPopout', path);

        if (this.debouncePopout) {
            return undefined;
        }

        const view = WebContentsManager.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return undefined;
        }

        const server = ServerManager.getServer(view.serverId);
        if (!server) {
            return undefined;
        }

        const existingView = ViewManager.getViewsByServerId(view.serverId).
            find((v) => v.type === ViewType.WINDOW && v.initialPath === path);
        if (existingView) {
            const window = this.popoutWindows.get(existingView.id);
            if (window) {
                window.browserWindow.show();
            }
            return existingView.id;
        }

        this.debouncePopout = true;
        setTimeout(() => {
            this.debouncePopout = false;
        }, POPOUT_RATE_LIMIT);

        return ViewManager.createView(server, ViewType.WINDOW, path, view.id, props)?.id;
    };

    private handleCanUsePopoutOption = (_: IpcMainInvokeEvent, optionName: string) => {
        switch (optionName) {
        case 'titleTemplate':
        case 'isRHS':
            return true;
        default:
            return false;
        }
    };

    private handleSendToParent = (event: IpcMainEvent, channel: string, ...args: unknown[]) => {
        const webContentsView = WebContentsManager.getViewByWebContentsId(event.sender.id);
        if (!webContentsView) {
            log.warn('handleSendToParent: no webContentsView found', {webContentsId: event.sender.id});
            return;
        }
        const view = ViewManager.getView(webContentsView.id);
        if (!view?.parentViewId) {
            return;
        }
        const parentView = WebContentsManager.getView(view.parentViewId);
        if (!parentView) {
            log.warn('handleSendToParent: no parentView found', {parentViewId: view.parentViewId});
            return;
        }
        parentView.sendToRenderer(MESSAGE_FROM_POPOUT, view.id, channel, ...args);
    };

    private handleSendToPopout = (_: IpcMainEvent, id: string, channel: string, ...args: unknown[]) => {
        const view = WebContentsManager.getView(id);
        if (!view) {
            log.debug('handleSendToPopout: no view found', {id});
            return;
        }
        view.sendToRenderer(MESSAGE_FROM_PARENT, channel, ...args);
    };

    private handleClearCacheAndReload = (event: IpcMainEvent) => {
        const viewId = this.getViewIdByWindowWebContentsId(event.sender.id);
        if (!viewId) {
            return;
        }
        WebContentsManager.clearCacheAndReloadView(viewId);
    };
}

const popoutManager = new PopoutManager();
export default popoutManager;
