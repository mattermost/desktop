// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent, View} from 'electron';
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
    SET_URL_FOR_URL_VIEW,
} from 'common/communication';
import Config from 'common/config';
import {DEFAULT_CHANGELOG_LINK} from 'common/constants';
import {Logger} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {SECOND, TAB_BAR_HEIGHT} from 'common/utils/constants';
import {getFormattedPathName, parseURL} from 'common/utils/url';
import Utils from 'common/utils/util';
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

const log = new Logger('ViewManager');
const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 20;

export class ViewManager {
    private views: Map<string, MattermostWebContentsView>;
    private currentView?: string;

    private urlView?: WebContentsView;
    private urlViewCancel?: () => void;

    constructor() {
        this.views = new Map(); // keep in mind that this doesn't need to hold server order, only views on the renderer need that.

        MainWindow.on(MAIN_WINDOW_CREATED, this.init);
        MainWindow.on(MAIN_WINDOW_RESIZED, this.handleSetCurrentViewBounds);
        MainWindow.on(MAIN_WINDOW_FOCUSED, this.focusCurrentView);
        ipcMain.handle(GET_VIEW_INFO_FOR_TEST, this.handleGetViewInfoForTest);
        ipcMain.handle(GET_IS_DEV_MODE, () => isDev);
        ipcMain.handle(REQUEST_BROWSER_HISTORY_STATUS, this.handleRequestBrowserHistoryStatus);
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
            // TODO: This init should be happening elsewhere, future refactor will fix this
            ServerViewState.init();
            LoadingScreen.show();

            // We need to wait for the current server to be initialized before showing anything
            // But we can initialize other servers in parallel
            const otherServers = ServerManager.getAllServers().filter((server) => server.id !== ServerViewState.getCurrentServer().id);
            const currentServer = ServerViewState.getCurrentServer();
            otherServers.forEach((server) => this.initServer(server));
            await this.initServer(currentServer);
            this.showInitial();
        }

        this.initURLView();
    };

    private initServer = async (server: MattermostServer) => {
        await updateServerInfos([server]);
        this.loadView(server);
    };

    private initURLView = () => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        const urlView = new WebContentsView({webPreferences: {preload: getLocalPreload('internalAPI.js')}});
        urlView.setBackgroundColor('#00000000');

        urlView.webContents.loadURL('mattermost-desktop://renderer/urlView.html');

        MainWindow.get()?.contentView.addChildView(urlView);

        performanceMonitor.registerView('URLView', urlView.webContents);

        this.urlView = urlView;
    };

    private handleDeveloperModeUpdated = (json: DeveloperSettings) => {
        log.debug('handleDeveloperModeUpdated', json);

        if (['browserOnly', 'disableContextMenu'].some((key) => Object.hasOwn(json, key))) {
            this.views.forEach((view) => view.destroy());
            this.views = new Map();
            this.init();
        }
    };

    getView = (viewId: string) => {
        return this.views.get(viewId);
    };

    getCurrentView = () => {
        if (this.currentView) {
            return this.views.get(this.currentView);
        }
        return undefined;
    };

    getViewByWebContentsId = (webContentsId: number) => {
        return [...this.views.values()].find((view) => view.webContentsId === webContentsId);
    };

    private isViewInFront = (view: View) => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return false;
        }

        const index = mainWindow.contentView.children.indexOf(view);
        const front = mainWindow.contentView.children.length - 1;
        return index === front;
    };

    showById = (viewId: string) => {
        this.getViewLogger(viewId).debug('showById', viewId);

        const newView = this.views.get(viewId);
        if (newView) {
            if (newView.isVisible) {
                return;
            }
            let hidePrevious;
            if (this.currentView && this.currentView !== viewId) {
                const previous = this.getCurrentView();
                if (previous) {
                    hidePrevious = () => previous.hide();
                }
            }

            this.currentView = viewId;
            if (!newView.isErrored()) {
                newView.show();
                if (newView.needsLoadingScreen()) {
                    LoadingScreen.show();
                }
            }
            hidePrevious?.();
            MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW, newView.server.id);
            ServerViewState.updateCurrentView(newView.server.id);
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
        this.views.forEach((view) => {
            if (!view.isDestroyed()) {
                view.sendToRenderer(channel, ...args);
            }
        });
    };

    sendToFind = () => {
        this.getCurrentView()?.openFind();
    };

    /**
     * Deep linking
     */

    handleDeepLink = (url: string | URL) => {
        if (url) {
            const parsedURL = parseURL(url)!;
            const server = ServerManager.lookupServerByURL(parsedURL, true);
            if (server) {
                const urlWithSchema = `${server.url.origin}${getFormattedPathName(parsedURL.pathname)}${parsedURL.search}`;
                const webContentsView = this.views.get(server.id);
                if (!webContentsView) {
                    log.error(`Couldn't find a view matching the id ${server.id}`);
                    return;
                }

                if (webContentsView.isReady() && ServerManager.getRemoteInfo(webContentsView.server.id)?.serverVersion && Utils.isVersionGreaterThanOrEqualTo(ServerManager.getRemoteInfo(webContentsView.server.id)?.serverVersion ?? '', '6.0.0')) {
                    const formattedServerURL = `${webContentsView.server.url.origin}${getFormattedPathName(webContentsView.server.url.pathname)}`;
                    const pathName = `/${urlWithSchema.replace(formattedServerURL, '')}`;
                    webContentsView.sendToRenderer(BROWSER_HISTORY_PUSH, pathName);
                    this.deeplinkSuccess(webContentsView.id);
                } else {
                    // attempting to change parsedURL protocol results in it not being modified.
                    webContentsView.resetLoadingStatus();
                    webContentsView.load(urlWithSchema);
                    webContentsView.once(LOAD_SUCCESS, this.deeplinkSuccess);
                    webContentsView.once(LOAD_FAILED, this.deeplinkFailed);
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
        this.views.get(viewId)?.removeListener(LOAD_FAILED, this.deeplinkFailed);
    };

    private deeplinkFailed = (viewId: string, err: string, url: string) => {
        this.getViewLogger(viewId).error(`failed to load deeplink ${url}`, err);
        this.views.get(viewId)?.removeListener(LOAD_SUCCESS, this.deeplinkSuccess);
    };

    /**
     * View loading helpers
     */

    private loadView = (srv: MattermostServer, url?: string) => {
        const webContentsView = this.makeView(srv, url);
        this.addView(webContentsView);
    };

    private makeView = (srv: MattermostServer, url?: string): MattermostWebContentsView => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            throw new Error('Cannot create view, no main window present');
        }

        const webContentsView = new MattermostWebContentsView(srv, {webPreferences: {spellcheck: Config.useSpellChecker}});
        webContentsView.once(LOAD_SUCCESS, this.activateView);
        webContentsView.on(LOADSCREEN_END, this.finishLoading);
        webContentsView.on(LOAD_FAILED, this.failLoading);
        webContentsView.on(UPDATE_TARGET_URL, this.showURLView);
        webContentsView.load(url);
        return webContentsView;
    };

    private addView = (view: MattermostWebContentsView): void => {
        this.views.set(view.id, view);

        // Force a permission check for notifications
        const notificationPermission = PermissionsManager.getForServer(view.server)?.notifications;
        if (!notificationPermission || (!notificationPermission.allowed && notificationPermission.alwaysDeny !== true)) {
            PermissionsManager.doPermissionRequest(
                view.webContentsId,
                'notifications',
                {
                    requestingUrl: view.server.url.toString(),
                    isMainFrame: false,
                },
            );
        }
    };

    private showInitial = () => {
        log.verbose('showInitial');

        ServerViewState.init();
        if (ServerManager.hasServers()) {
            const lastActiveServer = ServerViewState.getCurrentServer();
            this.showById(lastActiveServer.id);
        } else {
            MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW);
        }
    };

    /**
     * Mattermost view event handlers
     */

    private activateView = (viewId: string) => {
        this.getViewLogger(viewId).debug('activateView');

        if (this.currentView === viewId) {
            this.showById(this.currentView);
        }
    };

    private finishLoading = (viewId: string) => {
        this.getViewLogger(viewId).debug('finishLoading');

        if (this.currentView === viewId) {
            this.showById(this.currentView);
            LoadingScreen.fade();
        }
    };

    private failLoading = (viewId: string) => {
        this.getViewLogger(viewId).debug('failLoading');

        LoadingScreen.fade();
        if (this.currentView === viewId) {
            this.getCurrentView()?.hide();
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

            if (this.urlView && !this.isViewInFront(this.urlView)) {
                log.silly('moving URL view to front');
                MainWindow.get()?.contentView.addChildView(this.urlView);
            }

            this.urlView?.webContents.send(SET_URL_FOR_URL_VIEW, urlString);
            this.urlView?.setVisible(true);

            const boundaries = this.views.get(this.currentView || '')?.getBounds() ?? MainWindow.getBounds();

            const hideView = () => {
                delete this.urlViewCancel;

                this.urlView?.setVisible(false);
            };

            const adjustWidth = (event: IpcMainEvent, width: number) => {
                log.silly('showURLView.adjustWidth', width);

                if (!boundaries) {
                    return;
                }

                const bounds = {
                    x: 0,
                    y: (boundaries.height + TAB_BAR_HEIGHT) - URL_VIEW_HEIGHT,
                    width: width + 5, // add some padding to ensure that we don't cut off the border
                    height: URL_VIEW_HEIGHT,
                };

                log.silly('showURLView.setBounds', boundaries, bounds);
                this.urlView?.setBounds(bounds);
            };

            ipcMain.on(UPDATE_URL_VIEW_WIDTH, adjustWidth);

            const timeout = setTimeout(hideView,
                URL_VIEW_DURATION);

            this.urlViewCancel = () => {
                clearTimeout(timeout);
                ipcMain.removeListener(UPDATE_URL_VIEW_WIDTH, adjustWidth);
                hideView();
            };
        }
    };

    /**
     * Event Handlers
     */

    /** Called when a new configuration is received
     * Servers or views have been added or edited. We need to
     * close, open, or reload views, taking care to reuse views and
     * preserve focus on the currently selected view. */
    private handleReloadConfiguration = () => {
        log.debug('handleReloadConfiguration');

        const currentViewId: string | undefined = this.views.get(this.currentView as string)?.id;

        const current: Map<string, MattermostWebContentsView> = new Map();
        for (const view of this.views.values()) {
            current.set(view.id, view);
        }

        const views: Map<string, MattermostWebContentsView> = new Map();

        const servers = ServerManager.getAllServers();

        for (const server of servers) {
            const recycle = current.get(server.id);
            if (recycle) {
                views.set(server.id, recycle);
            } else {
                views.set(server.id, this.makeView(server, server.initialLoadURL?.toString()));
            }
        }

        // commit the data to our local state
        // destroy everything that no longer exists
        for (const [k, v] of current) {
            if (!views.has(k)) {
                v.destroy();
            }
        }

        // commit views
        this.views = new Map();
        for (const x of views.values()) {
            this.addView(x);
        }

        // show the focused view (or initial)
        if (currentViewId && views.has(currentViewId)) {
            const view = views.get(currentViewId);
            if (view && view.id !== this.currentView) {
                this.currentView = view.id;
                this.showById(view.id);
                MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW, view.id);
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

        // This method is only called when the specific view is logged in
        // so we need to call the `onLogin` for all of the views for the same server
        [...this.views.values()].
            filter((v) => v.server.id === view.server.id).
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
        if (currentView.server.url.pathname !== '/' && pathName.startsWith(currentView.server.url.pathname)) {
            cleanedPathName = pathName.replace(currentView.server.url.pathname, '');
        }
        const redirectedviewId = ServerManager.lookupServerByURL(`${currentView.server.url.toString().replace(/\/$/, '')}${cleanedPathName}`)?.id || currentView.id;
        let redirectedView = this.getView(redirectedviewId) || currentView;
        if (redirectedView !== currentView && redirectedView?.server.id === ServerViewState.getCurrentServer().id && (redirectedView?.isLoggedIn || cleanedPathName === '/')) {
            log.info('redirecting to a new view', redirectedView?.id || currentView.id);
            this.showById(redirectedView?.id || currentView.id);
        } else {
            redirectedView = currentView;
        }

        // Special case check for Channels to not force a redirect to "/", causing a refresh
        if (!(redirectedView !== currentView && cleanedPathName === '/')) {
            redirectedView?.sendToRenderer(BROWSER_HISTORY_PUSH, cleanedPathName);
            redirectedView?.updateHistoryButton();
        }
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
        shell.openExternal(view.server.url.toString());
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
        ServerManager.getServerLog(view.id, 'ViewManager').debug('handleSessionExpired', isExpired);

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

    /**
     * Helper functions
     */

    private getViewLogger = (viewId: string) => {
        return ServerManager.getServerLog(viewId, 'ViewManager');
    };

    private handleGetViewInfoForTest = (event: IpcMainInvokeEvent) => {
        const view = this.getViewByWebContentsId(event.sender.id);
        if (!view) {
            return null;
        }
        return {
            id: view.id,
            webContentsId: view.webContentsId,
            serverName: view.server.name,
        };
    };
}

const viewManager = new ViewManager();
export default viewManager;
