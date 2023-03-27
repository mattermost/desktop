// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';
import {BrowserView, dialog, ipcMain, IpcMainEvent} from 'electron';

import {SECOND, TAB_BAR_HEIGHT} from 'common/utils/constants';
import {
    UPDATE_TARGET_URL,
    LOAD_SUCCESS,
    LOAD_FAILED,
    TOGGLE_LOADING_SCREEN_VISIBILITY,
    LOADSCREEN_END,
    SET_ACTIVE_VIEW,
    OPEN_TAB,
    BROWSER_HISTORY_PUSH,
    UPDATE_LAST_ACTIVE,
    UPDATE_URL_VIEW_WIDTH,
    MAIN_WINDOW_SHOWN,
    DARK_MODE_CHANGE,
} from 'common/communication';
import Config from 'common/config';
import urlUtils from 'common/utils/url';
import Utils from 'common/utils/util';
import {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {TabView} from 'common/tabs/TabView';

import {localizeMessage} from 'main/i18nManager';
import MainWindow from 'main/windows/mainWindow';

import {getLocalURLString, getLocalPreload, getWindowBoundaries} from '../utils';

import {MattermostView} from './MattermostView';
import modalManager from './modalManager';
import WebContentsEventManager from './webContentEvents';

const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 20;

enum LoadingScreenState {
    VISIBLE = 1,
    FADING = 2,
    HIDDEN = 3,
}

export class ViewManager {
    private closedViews: Map<string, {srv: MattermostServer; tab: TabView}>;
    private views: Map<string, MattermostView>;
    private currentView?: string;

    private urlView?: BrowserView;
    private urlViewCancel?: () => void;
    private loadingScreen?: BrowserView;
    private loadingScreenState: LoadingScreenState;

    constructor() {
        this.views = new Map(); // keep in mind that this doesn't need to hold server order, only tabs on the renderer need that.
        this.closedViews = new Map();
        this.loadingScreenState = LoadingScreenState.HIDDEN;
    }

    loadServer = (server: MattermostServer) => {
        const tabs = ServerManager.getOrderedTabsForServer(server.id);
        tabs.forEach((tab) => this.loadView(server, tab));
    }

    makeView = (srv: MattermostServer, tab: TabView, url?: string): MattermostView => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            throw new Error('Cannot create view, no main window present');
        }

        const view = new MattermostView(tab, mainWindow, {webPreferences: {spellcheck: Config.useSpellChecker}});
        view.once(LOAD_SUCCESS, this.activateView);
        view.load(url);
        view.on(UPDATE_TARGET_URL, this.showURLView);
        view.on(LOADSCREEN_END, this.finishLoading);
        view.on(LOAD_FAILED, this.failLoading);
        return view;
    }

    addView = (view: MattermostView): void => {
        this.views.set(view.id, view);
        if (this.closedViews.has(view.id)) {
            this.closedViews.delete(view.id);
        }
        if (!this.loadingScreen) {
            this.createLoadingScreen();
        }
    }

    loadView = (srv: MattermostServer, tab: TabView, url?: string) => {
        if (!tab.isOpen) {
            this.closedViews.set(tab.id, {srv, tab});
            return;
        }
        const view = this.makeView(srv, tab, url);
        this.addView(view);
    }

    reloadViewIfNeeded = (viewName: string) => {
        const view = this.views.get(viewName);
        if (view && view.view.webContents.getURL() !== view.tab.url.toString() && !view.view.webContents.getURL().startsWith(view.tab.url.toString())) {
            view.load(view.tab.url);
        }
    }

    load = () => {
        ServerManager.getAllServers().forEach((server) => this.loadServer(server));
    }

    getView = (viewId: string) => {
        return this.views.get(viewId);
    }

    /** Called when a new configuration is received
     * Servers or tabs have been added or edited. We need to
     * close, open, or reload tabs, taking care to reuse tabs and
     * preserve focus on the currently selected tab. */
    reloadConfiguration = () => {
        log.debug('viewManager.reloadConfiguration');

        const currentTabId: string | undefined = this.views.get(this.currentView as string)?.tab.id;

        const current: Map<string, MattermostView> = new Map();
        for (const view of this.views.values()) {
            current.set(view.tab.id, view);
        }

        const views: Map<string, MattermostView> = new Map();
        const closed: Map<string, {srv: MattermostServer; tab: TabView}> = new Map();

        const sortedTabs = ServerManager.getAllServers().flatMap((x) => ServerManager.getOrderedTabsForServer(x.id).
            map((t): [MattermostServer, TabView] => [x, t]));

        for (const [srv, tab] of sortedTabs) {
            const recycle = current.get(tab.id);
            if (!tab.isOpen) {
                closed.set(tab.id, {srv, tab});
            } else if (recycle) {
                recycle.updateServerInfo(srv);
                views.set(tab.id, recycle);
            } else {
                views.set(tab.id, this.makeView(srv, tab));
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
            this.views.set(x.id, x);
        }

        // commit closed
        for (const x of closed.values()) {
            this.closedViews.set(x.tab.id, {srv: x.srv, tab: x.tab});
        }

        if ((currentTabId && closed.has(currentTabId)) || (this.currentView && this.closedViews.has(this.currentView))) {
            if (ServerManager.hasServers()) {
                this.currentView = undefined;
                this.showInitial();
            } else {
                MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW);
            }
        }

        // show the focused tab (or initial)
        if (currentTabId && views.has(currentTabId)) {
            const view = views.get(currentTabId);
            if (view && view.id !== this.currentView) {
                this.currentView = view.id;
                this.showById(view.id);
                MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW, view.tab.server.id, view.tab.id);
            } else {
                this.focus();
            }
        } else {
            this.showInitial();
        }
    }

    showInitial = () => {
        log.verbose('viewManager.showInitial');

        if (ServerManager.hasServers()) {
            const lastActiveServer = ServerManager.getCurrentServer();
            const lastActiveTab = ServerManager.getLastActiveTabForServer(lastActiveServer.id);
            this.showById(lastActiveTab.id);
        } else {
            MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW);
            ipcMain.emit(MAIN_WINDOW_SHOWN);
        }
    }

    showById = (tabId: string) => {
        log.debug('viewManager.showById', tabId);

        const newView = this.views.get(tabId);
        if (newView) {
            if (newView.isVisible) {
                return;
            }
            if (this.currentView && this.currentView !== tabId) {
                const previous = this.getCurrentView();
                if (previous) {
                    previous.hide();
                }
            }

            this.currentView = tabId;
            if (!newView.isErrored()) {
                newView.show();
                if (newView.needsLoadingScreen()) {
                    this.showLoadingScreen();
                }
            }
            newView.window.webContents.send(SET_ACTIVE_VIEW, newView.tab.server.id, newView.tab.id);
            ipcMain.emit(SET_ACTIVE_VIEW, true, newView.tab.server.id, newView.tab.id);
            if (newView.isReady()) {
                ipcMain.emit(UPDATE_LAST_ACTIVE, true, newView.tab.id);
            } else {
                log.warn(`couldn't show ${tabId}, not ready`);
            }
        } else {
            log.warn(`Couldn't find a view with name: ${tabId}`);
        }
        modalManager.showModal();
    }

    focus = () => {
        if (modalManager.isModalDisplayed()) {
            modalManager.focusCurrentModal();
            return;
        }

        const view = this.getCurrentView();
        if (view) {
            view.focus();
        }
    }

    activateView = (viewName: string) => {
        log.debug('viewManager.activateView', viewName);

        if (this.currentView === viewName) {
            this.showById(this.currentView);
        }
        const view = this.views.get(viewName);
        if (!view) {
            log.error(`Couldn't find a view with the name ${viewName}`);
            return;
        }
        WebContentsEventManager.addMattermostViewEventListeners(view);
    }

    finishLoading = (server: string) => {
        log.debug('viewManager.finishLoading', server);

        const view = this.views.get(server);
        if (view && this.getCurrentView() === view) {
            this.showById(this.currentView!);
            this.fadeLoadingScreen();
        }
    }

    openClosedTab = (id: string, url?: string) => {
        if (!this.closedViews.has(id)) {
            return;
        }
        const {srv, tab} = this.closedViews.get(id)!;
        tab.isOpen = true;
        this.loadView(srv, tab, url);
        this.showById(id);
        const view = this.views.get(id)!;
        view.isVisible = true;
        view.on(LOAD_SUCCESS, () => {
            view.isVisible = false;
            this.showById(id);
        });
        ipcMain.emit(OPEN_TAB, null, tab.id);
    }

    failLoading = (tabName: string) => {
        log.debug('viewManager.failLoading', tabName);

        this.fadeLoadingScreen();
        if (this.currentView === tabName) {
            this.getCurrentView()?.hide();
        }
    }

    getCurrentView() {
        if (this.currentView) {
            return this.views.get(this.currentView);
        }

        return undefined;
    }

    openViewDevTools = () => {
        const view = this.getCurrentView();
        if (view) {
            view.openDevTools();
        } else {
            log.error(`couldn't find ${this.currentView}`);
        }
    }

    findViewByWebContent(webContentId: number) {
        let found = null;
        let view;
        const entries = this.views.values();

        for (view of entries) {
            const wc = view.getWebContents();
            if (wc && wc.id === webContentId) {
                found = view;
            }
        }
        return found;
    }

    showURLView = (url: URL | string) => {
        log.silly('viewManager.showURLView', url);

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        if (this.urlViewCancel) {
            this.urlViewCancel();
        }
        if (url && url !== '') {
            const urlString = typeof url === 'string' ? url : url.toString();
            const preload = getLocalPreload('desktopAPI.js');
            const urlView = new BrowserView({
                webPreferences: {
                    preload,

                    // Workaround for this issue: https://github.com/electron/electron/issues/30993
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    transparent: true,
                }});
            const query = new Map([['url', urlString]]);
            const localURL = getLocalURLString('urlView.html', query);
            urlView.webContents.loadURL(localURL);
            MainWindow.get()?.addBrowserView(urlView);
            const boundaries = this.views.get(this.currentView || '')?.view.getBounds() ?? mainWindow.getBounds();

            const hideView = () => {
                delete this.urlViewCancel;
                try {
                    MainWindow.get()?.removeBrowserView(urlView);
                } catch (e) {
                    log.error('Failed to remove URL view', e);
                }

                // workaround to eliminate zombie processes
                // https://github.com/mattermost/desktop/pull/1519
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                urlView.webContents.destroy();
            };

            const adjustWidth = (event: IpcMainEvent, width: number) => {
                log.silly('showURLView.adjustWidth', width);

                const bounds = {
                    x: 0,
                    y: (boundaries.height + TAB_BAR_HEIGHT) - URL_VIEW_HEIGHT,
                    width: width + 5, // add some padding to ensure that we don't cut off the border
                    height: URL_VIEW_HEIGHT,
                };

                log.silly('showURLView setBounds', boundaries, bounds);
                urlView.setBounds(bounds);
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
    }

    setLoadingScreenBounds = () => {
        if (this.loadingScreen) {
            const mainWindow = MainWindow.get();
            if (!mainWindow) {
                return;
            }
            this.loadingScreen.setBounds(getWindowBoundaries(mainWindow));
        }
    }

    createLoadingScreen = () => {
        const preload = getLocalPreload('desktopAPI.js');
        this.loadingScreen = new BrowserView({webPreferences: {
            preload,

            // Workaround for this issue: https://github.com/electron/electron/issues/30993
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            transparent: true,
        }});
        const localURL = getLocalURLString('loadingScreen.html');
        this.loadingScreen.webContents.loadURL(localURL);
    }

    showLoadingScreen = () => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        if (!this.loadingScreen) {
            this.createLoadingScreen();
        }

        this.loadingScreenState = LoadingScreenState.VISIBLE;

        if (this.loadingScreen?.webContents.isLoading()) {
            this.loadingScreen.webContents.once('did-finish-load', () => {
                this.loadingScreen!.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            });
        } else {
            this.loadingScreen!.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
        }

        if (mainWindow.getBrowserViews().includes(this.loadingScreen!)) {
            mainWindow.setTopBrowserView(this.loadingScreen!);
        } else {
            mainWindow.addBrowserView(this.loadingScreen!);
        }

        this.setLoadingScreenBounds();
    }

    fadeLoadingScreen = () => {
        if (this.loadingScreen && this.loadingScreenState === LoadingScreenState.VISIBLE) {
            this.loadingScreenState = LoadingScreenState.FADING;
            this.loadingScreen.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, false);
        }
    }

    isViewClosed = (viewId: string) => {
        return this.closedViews.has(viewId);
    }

    isLoadingScreenHidden = () => {
        return this.loadingScreenState === LoadingScreenState.HIDDEN;
    }

    hideLoadingScreen = () => {
        if (this.loadingScreen && this.loadingScreenState !== LoadingScreenState.HIDDEN) {
            this.loadingScreenState = LoadingScreenState.HIDDEN;
            MainWindow.get()?.removeBrowserView(this.loadingScreen);
        }
    }

    setServerInitialized = (server: string) => {
        const view = this.views.get(server);
        if (view) {
            view.setInitialized();
            if (this.getCurrentView() === view) {
                this.fadeLoadingScreen();
            }
        }
    }

    updateLoadingScreenDarkMode = (darkMode: boolean) => {
        if (this.loadingScreen) {
            this.loadingScreen.webContents.send(DARK_MODE_CHANGE, darkMode);
        }
    }

    deeplinkSuccess = (viewId: string) => {
        log.debug('viewManager.deeplinkSuccess', viewId);

        const view = this.views.get(viewId);
        if (!view) {
            return;
        }
        this.showById(viewId);
        view.removeListener(LOAD_FAILED, this.deeplinkFailed);
    };

    deeplinkFailed = (viewId: string, err: string, url: string) => {
        log.error(`[${viewId}] failed to load deeplink ${url}: ${err}`);
        const view = this.views.get(viewId);
        if (!view) {
            return;
        }
        view.removeListener(LOAD_SUCCESS, this.deeplinkSuccess);
    }

    handleDeepLink = (url: string | URL) => {
        // TODO: fix for new tabs
        if (url) {
            const parsedURL = urlUtils.parseURL(url)!;
            const tabView = ServerManager.lookupTabByURL(parsedURL, true);
            if (tabView) {
                const urlWithSchema = `${tabView.url.origin}${parsedURL.pathname}${parsedURL.search}`;
                if (this.closedViews.has(tabView.id)) {
                    this.openClosedTab(tabView.id, urlWithSchema);
                } else {
                    const view = this.views.get(tabView.id);
                    if (!view) {
                        log.error(`Couldn't find a view matching the name ${tabView.id}`);
                        return;
                    }

                    if (view.isInitialized() && ServerManager.getRemoteInfo(view.tab.server.id)?.serverVersion && Utils.isVersionGreaterThanOrEqualTo(ServerManager.getRemoteInfo(view.tab.server.id)?.serverVersion ?? '', '6.0.0')) {
                        const pathName = `/${urlWithSchema.replace(view.tab.server.url.toString(), '')}`;
                        view.view.webContents.send(BROWSER_HISTORY_PUSH, pathName);
                        this.deeplinkSuccess(view.id);
                    } else {
                        // attempting to change parsedURL protocol results in it not being modified.
                        view.resetLoadingStatus();
                        view.load(urlWithSchema);
                        view.once(LOAD_SUCCESS, this.deeplinkSuccess);
                        view.once(LOAD_FAILED, this.deeplinkFailed);
                    }
                }
            } else {
                dialog.showErrorBox(
                    localizeMessage('main.views.viewManager.handleDeepLink.error.title', 'No matching server'),
                    localizeMessage('main.views.viewManager.handleDeepLink.error.body', 'There is no configured server in the app that matches the requested url: {url}', {url: parsedURL.toString()}),
                );
            }
        }
    };

    sendToAllViews = (channel: string, ...args: unknown[]) => {
        this.views.forEach((view) => {
            if (!view.view.webContents.isDestroyed()) {
                view.view.webContents.send(channel, ...args);
            }
        });
    }
}

const viewManager = new ViewManager();
export default viewManager;
