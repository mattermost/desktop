// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';
import {BrowserView, BrowserWindow, dialog, ipcMain, IpcMainEvent} from 'electron';
import {BrowserViewConstructorOptions} from 'electron/main';
import {Tuple as tuple} from '@bloomberg/record-tuple-polyfill';

import {Tab, TeamWithTabs} from 'types/config';

import {SECOND, TAB_BAR_HEIGHT} from 'common/utils/constants';
import {
    UPDATE_TARGET_URL,
    LOAD_SUCCESS,
    LOAD_FAILED,
    TOGGLE_LOADING_SCREEN_VISIBILITY,
    GET_LOADING_SCREEN_DATA,
    LOADSCREEN_END,
    SET_ACTIVE_VIEW,
    OPEN_TAB,
    BROWSER_HISTORY_PUSH,
    UPDATE_LAST_ACTIVE,
    UPDATE_URL_VIEW_WIDTH,
    MAIN_WINDOW_SHOWN,
} from 'common/communication';
import Config from 'common/config';
import urlUtils from 'common/utils/url';
import Utils from 'common/utils/util';
import {MattermostServer} from 'common/servers/MattermostServer';
import {getServerView, getTabViewName, TabTuple, TabType} from 'common/tabs/TabView';

import {localizeMessage} from 'main/i18nManager';
import {ServerInfo} from 'main/server/serverInfo';

import {getLocalURLString, getLocalPreload, getWindowBoundaries} from '../utils';

import {MattermostView} from './MattermostView';
import modalManager from './modalManager';
import WebContentsEventManager from './webContentEvents';

const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 20;

export enum LoadingScreenState {
    VISIBLE = 1,
    FADING = 2,
    HIDDEN = 3,
}

export class ViewManager {
    lastActiveServer?: number;
    viewOptions: BrowserViewConstructorOptions;
    closedViews: Map<string, {srv: MattermostServer; tab: Tab}>;
    views: Map<string, MattermostView>;
    currentView?: string;
    urlView?: BrowserView;
    urlViewCancel?: () => void;
    mainWindow: BrowserWindow;
    loadingScreen?: BrowserView;
    loadingScreenState: LoadingScreenState;

    constructor(mainWindow: BrowserWindow) {
        this.lastActiveServer = Config.lastActiveTeam;
        this.viewOptions = {webPreferences: {spellcheck: Config.useSpellChecker}};
        this.views = new Map(); // keep in mind that this doesn't need to hold server order, only tabs on the renderer need that.
        this.mainWindow = mainWindow;
        this.closedViews = new Map();
        this.loadingScreenState = LoadingScreenState.HIDDEN;
    }

    updateMainWindow = (mainWindow: BrowserWindow) => {
        this.mainWindow = mainWindow;
    }

    getServers = () => {
        return Config.teams.concat();
    }

    loadServer = (server: TeamWithTabs) => {
        const srv = new MattermostServer(server.name, server.url);
        const serverInfo = new ServerInfo(srv);
        server.tabs.forEach((tab) => this.loadView(srv, serverInfo, tab));
    }

    makeView = (srv: MattermostServer, serverInfo: ServerInfo, tab: Tab, url?: string): MattermostView => {
        const tabView = getServerView(srv, tab);
        const view = new MattermostView(tabView, serverInfo, this.mainWindow, this.viewOptions);
        view.once(LOAD_SUCCESS, this.activateView);
        view.load(url);
        view.on(UPDATE_TARGET_URL, this.showURLView);
        view.on(LOADSCREEN_END, this.finishLoading);
        view.on(LOAD_FAILED, this.failLoading);
        return view;
    }

    addView = (view: MattermostView): void => {
        this.views.set(view.name, view);
        if (this.closedViews.has(view.name)) {
            this.closedViews.delete(view.name);
        }
        if (!this.loadingScreen) {
            this.createLoadingScreen();
        }
    }

    loadView = (srv: MattermostServer, serverInfo: ServerInfo, tab: Tab, url?: string) => {
        if (!tab.isOpen) {
            this.closedViews.set(getTabViewName(srv.name, tab.name), {srv, tab});
            return;
        }
        const view = this.makeView(srv, serverInfo, tab, url);
        this.addView(view);
    }

    reloadViewIfNeeded = (viewName: string) => {
        const view = this.views.get(viewName);
        if (view && view.view.webContents.getURL() !== view.tab.url.toString() && !view.view.webContents.getURL().startsWith(view.tab.url.toString())) {
            view.load(view.tab.url);
        }
    }

    load = () => {
        this.getServers().forEach((server) => this.loadServer(server));
    }

    /** Called when a new configuration is received
     * Servers or tabs have been added or edited. We need to
     * close, open, or reload tabs, taking care to reuse tabs and
     * preserve focus on the currently selected tab. */
    reloadConfiguration = (configServers: TeamWithTabs[]) => {
        const focusedTuple: TabTuple | undefined = this.views.get(this.currentView as string)?.urlTypeTuple;

        const current: Map<TabTuple, MattermostView> = new Map();
        for (const view of this.views.values()) {
            current.set(view.urlTypeTuple, view);
        }

        const views: Map<TabTuple, MattermostView> = new Map();
        const closed: Map<TabTuple, {srv: MattermostServer; tab: Tab; name: string}> = new Map();

        const sortedTabs = configServers.flatMap((x) => [...x.tabs].
            sort((a, b) => a.order - b.order).
            map((t): [TeamWithTabs, Tab] => [x, t]));

        for (const [team, tab] of sortedTabs) {
            const srv = new MattermostServer(team.name, team.url);
            const info = new ServerInfo(srv);
            const view = getServerView(srv, tab);
            const tabTuple = tuple(new URL(team.url).href, tab.name as TabType);
            const recycle = current.get(tabTuple);
            if (!tab.isOpen) {
                closed.set(tabTuple, {srv, tab, name: view.name});
            } else if (recycle) {
                recycle.updateServerInfo(srv);
                views.set(tabTuple, recycle);
            } else {
                views.set(tabTuple, this.makeView(srv, info, tab, tabTuple[0]));
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
            this.views.set(x.name, x);
        }

        // commit closed
        for (const x of closed.values()) {
            this.closedViews.set(x.name, {srv: x.srv, tab: x.tab});
        }

        if ((focusedTuple && closed.has(focusedTuple)) || (this.currentView && this.closedViews.has(this.currentView))) {
            if (configServers.length) {
                delete this.currentView;
                this.showInitial();
            } else {
                this.mainWindow.webContents.send(SET_ACTIVE_VIEW);
            }
        }

        // show the focused tab (or initial)
        if (focusedTuple && views.has(focusedTuple)) {
            const view = views.get(focusedTuple);
            if (view) {
                this.currentView = view.name;
                this.showByName(view.name);
                this.mainWindow.webContents.send(SET_ACTIVE_VIEW, view.tab.server.name, view.tab.type);
            }
        } else {
            this.showInitial();
        }
    }

    showInitial = () => {
        const servers = this.getServers();
        if (servers.length) {
            const element = servers.find((e) => e.order === this.lastActiveServer) || servers.find((e) => e.order === 0);
            if (element && element.tabs.length) {
                let tab = element.tabs.find((tab) => tab.order === element.lastActiveTab) || element.tabs.find((tab) => tab.order === 0);
                if (!tab?.isOpen) {
                    const openTabs = element.tabs.filter((tab) => tab.isOpen);
                    tab = openTabs.find((e) => e.order === 0) || openTabs.concat().sort((a, b) => a.order - b.order)[0];
                }
                if (tab) {
                    const tabView = getTabViewName(element.name, tab.name);
                    this.showByName(tabView);
                }
            }
        } else {
            this.mainWindow.webContents.send(SET_ACTIVE_VIEW, null, null);
            ipcMain.emit(MAIN_WINDOW_SHOWN);
        }
    }

    showByName = (name: string) => {
        log.debug('viewManager.showByName', name);

        const newView = this.views.get(name);
        if (newView) {
            if (newView.isVisible) {
                return;
            }
            if (this.currentView && this.currentView !== name) {
                const previous = this.getCurrentView();
                if (previous) {
                    previous.hide();
                }
            }

            this.currentView = name;
            if (!newView.isErrored()) {
                newView.show();
                if (newView.needsLoadingScreen()) {
                    this.showLoadingScreen();
                }
            }
            newView.window.webContents.send(SET_ACTIVE_VIEW, newView.tab.server.name, newView.tab.type);
            ipcMain.emit(SET_ACTIVE_VIEW, true, newView.tab.server.name, newView.tab.type);
            if (newView.isReady()) {
                ipcMain.emit(UPDATE_LAST_ACTIVE, true, newView.tab.server.name, newView.tab.type);
            } else {
                log.warn(`couldn't show ${name}, not ready`);
            }
        } else {
            log.warn(`Couldn't find a view with name: ${name}`);
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
            this.showByName(this.currentView);
        }
        const view = this.views.get(viewName);
        if (!view) {
            log.error(`Couldn't find a view with the name ${viewName}`);
            return;
        }
        WebContentsEventManager.addMattermostViewEventListeners(view, this.getServers);
    }

    finishLoading = (server: string) => {
        log.debug('viewManager.finishLoading', server);

        const view = this.views.get(server);
        if (view && this.getCurrentView() === view) {
            this.showByName(this.currentView!);
            this.fadeLoadingScreen();
        }
    }

    openClosedTab = (name: string, url?: string) => {
        if (!this.closedViews.has(name)) {
            return;
        }
        const {srv, tab} = this.closedViews.get(name)!;
        tab.isOpen = true;
        this.loadView(srv, new ServerInfo(srv), tab, url);
        this.showByName(name);
        const view = this.views.get(name)!;
        view.isVisible = true;
        view.on(LOAD_SUCCESS, () => {
            view.isVisible = false;
            this.showByName(name);
        });
        ipcMain.emit(OPEN_TAB, null, srv.name, tab.name);
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

        if (this.urlViewCancel) {
            this.urlViewCancel();
        }
        if (url && url !== '') {
            const urlString = typeof url === 'string' ? url : url.toString();
            const preload = getLocalPreload('urlView.js');
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
            this.mainWindow.addBrowserView(urlView);
            const boundaries = this.views.get(this.currentView || '')?.view.getBounds() ?? this.mainWindow.getBounds();

            const hideView = () => {
                delete this.urlViewCancel;
                try {
                    this.mainWindow.removeBrowserView(urlView);
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
            this.loadingScreen.setBounds(getWindowBoundaries(this.mainWindow));
        }
    }

    createLoadingScreen = () => {
        const preload = getLocalPreload('loadingScreenPreload.js');
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

        if (this.mainWindow.getBrowserViews().includes(this.loadingScreen!)) {
            this.mainWindow.setTopBrowserView(this.loadingScreen!);
        } else {
            this.mainWindow.addBrowserView(this.loadingScreen!);
        }

        this.setLoadingScreenBounds();
    }

    fadeLoadingScreen = () => {
        if (this.loadingScreen && this.loadingScreenState === LoadingScreenState.VISIBLE) {
            this.loadingScreenState = LoadingScreenState.FADING;
            this.loadingScreen.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, false);
        }
    }

    hideLoadingScreen = () => {
        if (this.loadingScreen && this.loadingScreenState !== LoadingScreenState.HIDDEN) {
            this.loadingScreenState = LoadingScreenState.HIDDEN;
            this.mainWindow.removeBrowserView(this.loadingScreen);
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
            this.loadingScreen.webContents.send(GET_LOADING_SCREEN_DATA, {darkMode});
        }
    }

    deeplinkSuccess = (viewName: string) => {
        log.debug('viewManager.deeplinkSuccess', viewName);

        const view = this.views.get(viewName);
        if (!view) {
            return;
        }
        this.showByName(viewName);
        view.removeListener(LOAD_FAILED, this.deeplinkFailed);
    };

    deeplinkFailed = (viewName: string, err: string, url: string) => {
        log.error(`[${viewName}] failed to load deeplink ${url}: ${err}`);
        const view = this.views.get(viewName);
        if (!view) {
            return;
        }
        view.removeListener(LOAD_SUCCESS, this.deeplinkSuccess);
    }

    handleDeepLink = (url: string | URL) => {
        // TODO: fix for new tabs
        if (url) {
            const parsedURL = urlUtils.parseURL(url)!;
            const tabView = urlUtils.getView(parsedURL, this.getServers(), true);
            if (tabView) {
                const urlWithSchema = `${urlUtils.parseURL(tabView.url)?.origin}${parsedURL.pathname}${parsedURL.search}`;
                if (this.closedViews.has(tabView.name)) {
                    this.openClosedTab(tabView.name, urlWithSchema);
                } else {
                    const view = this.views.get(tabView.name);
                    if (!view) {
                        log.error(`Couldn't find a view matching the name ${tabView.name}`);
                        return;
                    }

                    if (view.isInitialized() && view.serverInfo.remoteInfo.serverVersion && Utils.isVersionGreaterThanOrEqualTo(view.serverInfo.remoteInfo.serverVersion, '6.0.0')) {
                        const pathName = `/${urlWithSchema.replace(view.tab.server.url.toString(), '')}`;
                        view.view.webContents.send(BROWSER_HISTORY_PUSH, pathName);
                        this.deeplinkSuccess(view.name);
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
        this.views.forEach((view) => view.view.webContents.send(channel, ...args));
    }
}
