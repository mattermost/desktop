// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent} from 'electron';
import {WebContentsView, ipcMain, shell} from 'electron';
import isDev from 'electron-is-dev';

import ServerViewState from 'app/serverViewState';
import AppState from 'common/appState';
import {
    UPDATE_TARGET_URL,
    LOAD_SUCCESS,
    LOAD_FAILED,
    LOADSCREEN_END,
    SET_ACTIVE_VIEW,
    OPEN_VIEW,
    BROWSER_HISTORY_PUSH,
    UPDATE_URL_VIEW_WIDTH,
    SERVERS_UPDATE,
    REACT_APP_INITIALIZED,
    OPEN_SERVER_EXTERNALLY,
    OPEN_SERVER_UPGRADE_LINK,
    OPEN_CHANGELOG_LINK,
    HISTORY,
    GET_VIEW_INFO_FOR_TEST,
    SESSION_EXPIRED,
    MAIN_WINDOW_CREATED,
    MAIN_WINDOW_RESIZED,
    MAIN_WINDOW_FOCUSED,
    SWITCH_TAB,
    GET_IS_DEV_MODE,
    REQUEST_BROWSER_HISTORY_STATUS,
    UNREADS_AND_MENTIONS,
    TAB_LOGIN_CHANGED,
    DEVELOPER_MODE_UPDATED,
    GET_ORDERED_TABS_FOR_SERVER,
} from 'common/communication';
import Config from 'common/config';
import {DEFAULT_CHANGELOG_LINK} from 'common/constants';
import {Logger} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {SECOND, TAB_BAR_HEIGHT} from 'common/utils/constants';
import {getFormattedPathName, parseURL} from 'common/utils/url';
import Utils from 'common/utils/util';
import type {MattermostView} from 'common/views/viewManager';
import viewManager from 'common/views/viewManager';
import {handleWelcomeScreenModal} from 'main/app/intercom';
import {flushCookiesStore, updateServerInfos} from 'main/app/utils';
import DeveloperMode from 'main/developerMode';
import performanceMonitor from 'main/performanceMonitor';
import PermissionsManager from 'main/permissionsManager';
import ModalManager from 'main/views/modalManager';
import MainWindow from 'main/windows/mainWindow';

import type {DeveloperSettings} from 'types/settings';

import LoadingScreen from './loadingScreen';
import {MattermostWebContentsView} from './MattermostWebContentsView';

import {getLocalPreload, getAdjustedWindowBoundaries} from '../utils';

const log = new Logger('WebContentsManager');
const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 20;

export class WebContentsManager {
    private webContentsViews: Map<string, MattermostWebContentsView>;
    private webContentsIdToView: Map<number, MattermostWebContentsView>;
    private urlViewCancel?: () => void;

    constructor() {
        this.webContentsViews = new Map();
        this.webContentsIdToView = new Map();

        // Subscribe to ViewManager events
        viewManager.on('view-opened', this.handleViewOpened);
        viewManager.on('view-closed', this.handleViewClosed);
        viewManager.on('view-updated', this.handleViewUpdated);
        viewManager.on('view-order-updated', this.handleViewOrderUpdated);

        // Subscribe to Electron events
        MainWindow.on(MAIN_WINDOW_CREATED, this.init);
        MainWindow.on(MAIN_WINDOW_RESIZED, this.handleSetCurrentViewBounds);
        MainWindow.on(MAIN_WINDOW_FOCUSED, this.focusCurrentView);
        ipcMain.handle(GET_VIEW_INFO_FOR_TEST, this.handleGetViewInfoForTest);
        ipcMain.handle(GET_IS_DEV_MODE, () => isDev);
        ipcMain.handle(REQUEST_BROWSER_HISTORY_STATUS, this.handleRequestBrowserHistoryStatus);
        ipcMain.handle(GET_ORDERED_TABS_FOR_SERVER, this.handleGetOrderedViewsForServer);
        ipcMain.on(HISTORY, this.handleHistory);
        ipcMain.on(REACT_APP_INITIALIZED, this.handleReactAppInitialized);
        ipcMain.on(BROWSER_HISTORY_PUSH, this.handleBrowserHistoryPush);
        ipcMain.on(TAB_LOGIN_CHANGED, this.handleTabLoginChanged);
        ipcMain.on(OPEN_SERVER_EXTERNALLY, this.handleOpenServerExternally);
        ipcMain.on(OPEN_SERVER_UPGRADE_LINK, this.handleOpenServerUpgradeLink);
        ipcMain.on(OPEN_CHANGELOG_LINK, this.handleOpenChangelogLink);
        ipcMain.on(UNREADS_AND_MENTIONS, this.handleUnreadsAndMentionsChanged);
        ipcMain.on(SESSION_EXPIRED, this.handleSessionExpired);
        ipcMain.on(SWITCH_TAB, (event, viewId) => this.showById(viewId));
        ServerManager.on(SERVERS_UPDATE, this.handleReloadConfiguration);
        DeveloperMode.on(DEVELOPER_MODE_UPDATED, this.handleDeveloperModeUpdated);
    }

    private init = async () => {
        if (ServerManager.hasServers()) {
            ServerViewState.init();
            await updateServerInfos(ServerManager.getAllServers());
            LoadingScreen.show();
            ServerManager.getAllServers().forEach((server) => this.loadServer(server));
            this.showInitial();
        }
    };

    private handleDeveloperModeUpdated = (json: DeveloperSettings) => {
        log.debug('handleDeveloperModeUpdated', json);

        if (['browserOnly', 'disableContextMenu'].some((key) => Object.hasOwn(json, key))) {
            this.webContentsViews.forEach((view) => view.destroy());
            this.webContentsViews = new Map();
            this.webContentsIdToView = new Map();
            this.init();
        }
    };

    getView = (id: string) => {
        return this.webContentsViews.get(id);
    };

    getCurrentView = () => {
        const activeView = viewManager.getActiveView();
        return activeView ? this.webContentsViews.get(activeView.id) : undefined;
    };

    getViewByWebContentsId = (webContentsId: number) => {
        return this.webContentsIdToView.get(webContentsId);
    };

    showById = (viewId: string) => {
        this.getViewLogger(viewId).debug('showById', viewId);

        const newView = this.webContentsViews.get(viewId);
        if (newView) {
            if (newView.isVisible) {
                return;
            }

            // Hide the current view first
            const currentView = this.getCurrentView();
            if (currentView && currentView.id !== viewId) {
                currentView.hide();
            }

            // Show the new view
            viewManager.setActiveView(newView.view);
            if (!newView.isErrored()) {
                newView.show();
                if (newView.needsLoadingScreen()) {
                    LoadingScreen.show();
                }

                // Ensure the view is activated when switching servers
                if (newView.isReady()) {
                    this.activateView(viewId);
                } else {
                    newView.once(LOAD_SUCCESS, () => this.activateView(viewId));
                }
            }

            MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW, newView.view.server.id, newView.view.id);
            ServerViewState.updateCurrentView(newView.view.server.id);
        } else {
            this.getViewLogger(viewId).warn(`Couldn't find a view with name: ${viewId}`);
        }
        ModalManager.showModal();
    };

    focusCurrentView = () => {
        log.debug('focusCurrentView');

        if (ModalManager.isModalDisplayed()) {
            ModalManager.focusCurrentModal();
            return;
        }

        const view = this.getCurrentView();
        if (view) {
            view.focus();
        }
    };

    reload = () => {
        const currentView = this.getCurrentView();
        if (currentView) {
            LoadingScreen.show();
            currentView.reload(currentView.currentURL);
        }
    };

    sendToAllViews = (channel: string, ...args: unknown[]) => {
        this.webContentsViews.forEach((view) => {
            if (!view.isDestroyed()) {
                view.sendToRenderer(channel, ...args);
            }
        });
    };

    sendToFind = () => {
        this.getCurrentView()?.openFind();
    };

    handleDeepLink = (url: string | URL) => {
        if (url) {
            const parsedURL = parseURL(url)!;
            const server = ServerManager.lookupViewByURL(parsedURL, true);
            if (server) {
                const view = viewManager.getViewByServerId(server.id);
                if (view) {
                    const urlWithSchema = `${view.server.url.origin}${getFormattedPathName(parsedURL.pathname)}${parsedURL.search}`;
                    if (viewManager.isViewClosed(view.id)) {
                        viewManager.openClosedView(view.id, view.server);
                        const webContentsView = this.webContentsViews.get(view.id);
                        if (webContentsView) {
                            webContentsView.load(urlWithSchema);
                        }
                    } else {
                        const webContentsView = this.webContentsViews.get(view.id);
                        if (!webContentsView) {
                            log.error(`Couldn't find a view matching the id ${view.id}`);
                            return;
                        }

                        if (webContentsView.isReady() && ServerManager.getRemoteInfo(webContentsView.view.server.id)?.serverVersion && Utils.isVersionGreaterThanOrEqualTo(ServerManager.getRemoteInfo(webContentsView.view.server.id)?.serverVersion ?? '', '6.0.0')) {
                            const formattedServerURL = `${webContentsView.view.server.url.origin}${getFormattedPathName(webContentsView.view.server.url.pathname)}`;
                            const pathName = `/${urlWithSchema.replace(formattedServerURL, '')}`;
                            webContentsView.sendToRenderer(BROWSER_HISTORY_PUSH, pathName);
                            this.deeplinkSuccess(webContentsView.id);
                        } else {
                            webContentsView.resetLoadingStatus();
                            webContentsView.load(urlWithSchema);
                            webContentsView.once(LOAD_SUCCESS, this.deeplinkSuccess);
                            webContentsView.once(LOAD_FAILED, this.deeplinkFailed);
                        }
                    }
                }
            } else if (ServerManager.hasServers()) {
                ServerViewState.showNewServerModal(`${parsedURL.host}${getFormattedPathName(parsedURL.pathname)}${parsedURL.search}`);
            } else {
                ModalManager.removeModal('welcomeScreen');
                handleWelcomeScreenModal(`${parsedURL.host}${getFormattedPathName(parsedURL.pathname)}${parsedURL.search}`);
            }
        }
    };

    private deeplinkSuccess = (viewId: string) => {
        this.getViewLogger(viewId).debug('deeplinkSuccess');
        this.showById(viewId);
        this.webContentsViews.get(viewId)?.removeListener(LOAD_FAILED, this.deeplinkFailed);
    };

    private deeplinkFailed = (viewId: string, err: string, url: string) => {
        this.getViewLogger(viewId).error(`failed to load deeplink ${url}`, err);
        this.webContentsViews.get(viewId)?.removeListener(LOAD_SUCCESS, this.deeplinkSuccess);
    };

    loadServer = (server: MattermostServer) => {
        log.info('loadServer', server.id);
        const views = viewManager.getOrderedTabsForServer(server.id);
        views.forEach((view) => this.loadView(server, view));
    };

    private loadView = (srv: MattermostServer, view: MattermostView, url?: string) => {
        const webContentsView = this.makeView(srv, view, url);
        this.addView(webContentsView);
    };

    private makeView = (srv: MattermostServer, view: MattermostView, url?: string): MattermostWebContentsView => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            throw new Error('Cannot create view, no main window present');
        }

        const webContentsView = new MattermostWebContentsView(view, {webPreferences: {spellcheck: Config.useSpellChecker}});
        webContentsView.once(LOAD_SUCCESS, this.activateView);
        webContentsView.on(LOADSCREEN_END, this.finishLoading);
        webContentsView.on(LOAD_FAILED, this.failLoading);
        webContentsView.on(UPDATE_TARGET_URL, this.showURLView);
        webContentsView.load(url);
        return webContentsView;
    };

    private addView = (view: MattermostWebContentsView): void => {
        this.webContentsViews.set(view.id, view);
        this.webContentsIdToView.set(view.webContentsId, view);

        // Force a permission check for notifications
        const notificationPermission = PermissionsManager.getForServer(view.view.server)?.notifications;
        if (!notificationPermission || (!notificationPermission.allowed && notificationPermission.alwaysDeny !== true)) {
            PermissionsManager.doPermissionRequest(
                view.webContentsId,
                'notifications',
                {
                    requestingUrl: view.view.server.url.toString(),
                    isMainFrame: false,
                },
            );
        }
    };

    private showInitial = () => {
        log.verbose('showInitial');

        if (ServerManager.hasServers()) {
            const currentServer = ServerViewState.getCurrentServer();
            const view = viewManager.getViewByServerId(currentServer.id);
            if (view) {
                this.showById(view.id);
            }
        } else {
            MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW);
        }
    };

    private activateView = (viewId: string) => {
        this.getViewLogger(viewId).debug('activateView');

        const currentView = this.getCurrentView();
        if (currentView?.id === viewId) {
            this.showById(viewId);
        }
    };

    private finishLoading = (viewId: string) => {
        this.getViewLogger(viewId).debug('finishLoading');

        const currentView = this.getCurrentView();
        if (currentView?.id === viewId) {
            this.showById(viewId);
            LoadingScreen.fade();
        }
    };

    private failLoading = (viewId: string) => {
        this.getViewLogger(viewId).debug('failLoading');

        LoadingScreen.fade();
        const currentView = this.getCurrentView();
        if (currentView?.id === viewId) {
            currentView.hide();
        }
    };

    private showURLView = (url: URL | string) => {
        log.silly('showURLView', url);

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        if (this.urlViewCancel) {
            this.urlViewCancel();
        }
        if (url && url !== '') {
            const urlString = typeof url === 'string' ? url : url.toString();
            const urlView = new WebContentsView({webPreferences: {preload: getLocalPreload('internalAPI.js')}});
            urlView.setBackgroundColor('#00000000');
            const localURL = `mattermost-desktop://renderer/urlView.html?url=${encodeURIComponent(urlString)}`;
            performanceMonitor.registerView('URLView', urlView.webContents);
            urlView.webContents.loadURL(localURL);

            urlView.webContents.on('focus', () => {
                log.debug('URL view focus prevented');
                this.getCurrentView()?.focus();
            });

            MainWindow.get()?.contentView.addChildView(urlView);
            const boundaries = this.webContentsViews.get(this.getCurrentView()?.id || '')?.getBounds() ?? MainWindow.getBounds();

            const hideView = () => {
                delete this.urlViewCancel;
                try {
                    mainWindow.contentView.removeChildView(urlView);
                } catch (e) {
                    log.error('Failed to remove URL view', e);
                }

                performanceMonitor.unregisterView(urlView.webContents.id);
                urlView.webContents.close();
            };

            const adjustWidth = (event: IpcMainEvent, width: number) => {
                log.silly('showURLView.adjustWidth', width);

                if (!boundaries) {
                    return;
                }

                const bounds = {
                    x: 0,
                    y: (boundaries.height + TAB_BAR_HEIGHT) - URL_VIEW_HEIGHT,
                    width: width + 5,
                    height: URL_VIEW_HEIGHT,
                };

                log.silly('showURLView.setBounds', boundaries, bounds);
                urlView.setBounds(bounds);
            };

            ipcMain.on(UPDATE_URL_VIEW_WIDTH, adjustWidth);

            const timeout = setTimeout(hideView, URL_VIEW_DURATION);

            this.urlViewCancel = () => {
                clearTimeout(timeout);
                ipcMain.removeListener(UPDATE_URL_VIEW_WIDTH, adjustWidth);
                hideView();
            };
        }
    };

    private handleReloadConfiguration = () => {
        log.debug('handleReloadConfiguration');

        const currentViewId = this.getCurrentView()?.view.id;
        const currentServer = ServerViewState.getCurrentServer();

        const current: Map<string, MattermostWebContentsView> = new Map();
        for (const view of this.webContentsViews.values()) {
            current.set(view.view.id, view);
        }

        const views: Map<string, MattermostWebContentsView> = new Map();

        const sortedViews = ServerManager.getAllServers().flatMap((x) => viewManager.getOrderedTabsForServer(x.id).
            map((t: MattermostView): [MattermostServer, MattermostView] => [x, t]));

        for (const [srv, view] of sortedViews) {
            const recycle = current.get(view.id);
            if (recycle) {
                views.set(view.id, recycle);
            } else {
                views.set(view.id, this.makeView(srv, view, srv.initialLoadURL?.toString()));
            }
        }

        for (const [k, v] of current) {
            if (!views.has(k)) {
                v.destroy();
            }
        }

        this.webContentsViews = new Map();
        this.webContentsIdToView = new Map();
        for (const x of views.values()) {
            this.addView(x);
        }

        // Get the view for the current server
        const currentServerView = viewManager.getViewByServerId(currentServer.id);
        if (currentServerView && views.has(currentServerView.id)) {
            const view = views.get(currentServerView.id);
            if (view && view.id !== this.getCurrentView()?.id) {
                this.showById(view.id);
                MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW, view.view.server.id, view.view.id);
            } else {
                this.focusCurrentView();
            }
        } else if (currentViewId && views.has(currentViewId)) {
            const view = views.get(currentViewId);
            if (view && view.id !== this.getCurrentView()?.id) {
                this.showById(view.id);
                MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW, view.view.server.id, view.view.id);
            } else {
                this.focusCurrentView();
            }
        } else {
            this.showInitial();
        }
    };

    private handleHistory = (event: IpcMainEvent, offset: number) => {
        this.getCurrentView()?.goToOffset(offset);
    };

    private handleTabLoginChanged = (event: IpcMainEvent, loggedIn: boolean) => {
        log.debug('handleTabLoggedIn', event.sender.id);
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return;
        }

        [...this.webContentsViews.values()].
            filter((v) => v.view.server.id === view.view.server.id).
            forEach((v) => v.onLogin(loggedIn));

        if (!loggedIn) {
            AppState.clear(view.id);
        }
        flushCookiesStore();
    };

    private handleBrowserHistoryPush = (e: IpcMainEvent, pathName: string) => {
        log.debug('handleBrowserHistoryPush', e.sender.id, pathName);

        const currentView = this.getViewByWebContentsId(e.sender.id);
        if (!currentView) {
            return;
        }
        let cleanedPathName = pathName;
        if (currentView.view.server.url.pathname !== '/' && pathName.startsWith(currentView.view.server.url.pathname)) {
            cleanedPathName = pathName.replace(currentView.view.server.url.pathname, '');
        }
        const redirectedviewId = ServerManager.lookupViewByURL(`${currentView.view.server.url.toString().replace(/\/$/, '')}${cleanedPathName}`)?.id || currentView.id;
        if (viewManager.isViewClosed(redirectedviewId)) {
            viewManager.openClosedView(redirectedviewId, currentView.view.server);
            const webContentsView = this.webContentsViews.get(redirectedviewId);
            if (webContentsView) {
                webContentsView.load(`${currentView.view.server.url}${cleanedPathName}`);
            }
            return;
        }
        let redirectedView = this.getView(redirectedviewId) || currentView;
        if (redirectedView !== currentView && redirectedView?.view.server.id === ServerViewState.getCurrentServer().id && (redirectedView?.isLoggedIn || cleanedPathName === '/')) {
            log.info('redirecting to a new view', redirectedView?.id || currentView.id);
            this.showById(redirectedView?.id || currentView.id);
        } else {
            redirectedView = currentView;
        }

        redirectedView?.sendToRenderer(BROWSER_HISTORY_PUSH, cleanedPathName);
        redirectedView?.updateHistoryButton();
    };

    private handleRequestBrowserHistoryStatus = (e: IpcMainInvokeEvent) => {
        log.silly('handleRequestBrowserHistoryStatus', e.sender.id);
        return this.getViewByWebContentsId(e.sender.id)?.getBrowserHistoryStatus();
    };

    private handleReactAppInitialized = (e: IpcMainEvent) => {
        log.debug('handleReactAppInitialized', e.sender.id);

        const view = this.getViewByWebContentsId(e.sender.id);
        if (view) {
            view.setInitialized();
            if (this.getCurrentView() === view) {
                LoadingScreen.fade();
            }
        }
    };

    private handleOpenServerExternally = () => {
        log.debug('handleOpenServerExternally');

        const view = this.getCurrentView();
        if (!view) {
            return;
        }
        shell.openExternal(view.view.server.url.toString());
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
        AppState.updateUnreads(view.id, isUnread);
        AppState.updateMentions(view.id, mentionCount);
    };

    private handleSessionExpired = (event: IpcMainEvent, isExpired: boolean) => {
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return;
        }
        this.getViewLogger(view.id).debug('handleSessionExpired', isExpired);

        AppState.updateExpired(view.id, isExpired);
    };

    private handleSetCurrentViewBounds = (newBounds: Electron.Rectangle) => {
        log.debug('handleSetCurrentViewBounds', newBounds);

        const currentView = this.getCurrentView();
        if (currentView && currentView.currentURL) {
            const adjustedBounds = getAdjustedWindowBoundaries(newBounds.width, newBounds.height);
            currentView.setBounds(adjustedBounds);
        }
    };

    private handleViewOpened = (viewId: string) => {
        const view = this.webContentsViews.get(viewId);
        if (view) {
            view.isVisible = true;
            view.on(LOAD_SUCCESS, () => {
                view.isVisible = false;
                this.showById(viewId);
            });
            ipcMain.emit(OPEN_VIEW, null, view.view.id);
        }
    };

    private handleViewClosed = (viewId: string) => {
        const view = this.webContentsViews.get(viewId);
        if (view) {
            view.destroy();
            this.webContentsViews.delete(viewId);
            this.webContentsIdToView.delete(view.webContentsId);
        }
    };

    private handleViewUpdated = (viewId: string) => {
        const view = this.webContentsViews.get(viewId);
        if (view) {
            this.showById(viewId);
        }
    };

    private handleViewOrderUpdated = () => {
        this.handleReloadConfiguration();
    };

    private getViewLogger = (viewId: string) => {
        return viewManager.getViewLog(viewId, 'WebContentsManager');
    };

    private handleGetViewInfoForTest = (event: IpcMainInvokeEvent) => {
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return null;
        }
        return {
            id: view.id,
            webContentsId: view.webContentsId,
            serverName: view.view.server.name,
        };
    };

    private handleGetOrderedViewsForServer = (event: IpcMainInvokeEvent, serverId: string) => {
        this.getViewLogger(serverId).debug('handleGetOrderedViewsForServer');
        return viewManager.getOrderedTabsForServer(serverId).map((view) => view.toUniqueView());
    };

    destroy(): void {
        this.webContentsViews.forEach((view) => {
            view.destroy();
        });
        this.webContentsViews.clear();
        this.webContentsIdToView.clear();
    }

    destroyAllViews(): void {
        this.webContentsViews.forEach((view) => {
            view.destroy();
        });
        this.webContentsViews.clear();
        this.webContentsIdToView.clear();
    }
}

const webContentsManager = new WebContentsManager();
export default webContentsManager;
