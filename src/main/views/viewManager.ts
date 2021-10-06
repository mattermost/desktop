// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';
import {BrowserView, BrowserWindow, dialog, ipcMain} from 'electron';
import {BrowserViewConstructorOptions} from 'electron/main';

import {CombinedConfig, Tab, TeamWithTabs} from 'types/config';

import {SECOND} from 'common/utils/constants';
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
} from 'common/communication';
import urlUtils from 'common/utils/url';
import Utils from 'common/utils/util';

import {getServerView, getTabViewName} from 'common/tabs/TabView';

import {ServerInfo} from 'main/server/serverInfo';
import {MattermostServer} from '../../common/servers/MattermostServer';
import {getLocalURLString, getLocalPreload, getWindowBoundaries} from '../utils';

import {MattermostView, Status} from './MattermostView';
import {showModal, isModalDisplayed, focusCurrentModal} from './modalManager';
import {addWebContentsEventListeners} from './webContentEvents';

const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 36;

export class ViewManager {
    configServers: TeamWithTabs[];
    lastActiveServer?: number;
    viewOptions: BrowserViewConstructorOptions;
    closedViews: Map<string, {srv: MattermostServer; tab: Tab}>;
    views: Map<string, MattermostView>;
    currentView?: string;
    urlView?: BrowserView;
    urlViewCancel?: () => void;
    mainWindow: BrowserWindow;
    loadingScreen?: BrowserView;

    constructor(config: CombinedConfig, mainWindow: BrowserWindow) {
        this.configServers = config.teams;
        this.lastActiveServer = config.lastActiveTeam;
        this.viewOptions = {webPreferences: {spellcheck: config.useSpellChecker}};
        this.views = new Map(); // keep in mind that this doesn't need to hold server order, only tabs on the renderer need that.
        this.mainWindow = mainWindow;
        this.closedViews = new Map();
    }

    updateMainWindow = (mainWindow: BrowserWindow) => {
        this.mainWindow = mainWindow;
    }

    getServers = () => {
        return this.configServers;
    }

    loadServer = (server: TeamWithTabs) => {
        const srv = new MattermostServer(server.name, server.url);
        const serverInfo = new ServerInfo(srv);
        server.tabs.forEach((tab) => this.loadView(srv, serverInfo, tab));
    }

    loadView = (srv: MattermostServer, serverInfo: ServerInfo, tab: Tab, url?: string) => {
        const tabView = getServerView(srv, tab);
        if (!tab.isOpen) {
            this.closedViews.set(tabView.name, {srv, tab});
            return;
        }
        const view = new MattermostView(tabView, serverInfo, this.mainWindow, this.viewOptions);
        this.views.set(tabView.name, view);
        this.showByName(tabView.name);
        if (!this.loadingScreen) {
            this.createLoadingScreen();
        }
        view.once(LOAD_SUCCESS, this.activateView);
        view.load(url);
        view.on(UPDATE_TARGET_URL, this.showURLView);
        view.on(LOADSCREEN_END, this.finishLoading);
        view.once(LOAD_FAILED, this.failLoading);
    }

    reloadViewIfNeeded = (viewName: string) => {
        const view = this.views.get(viewName);
        if (view && !view.view.webContents.getURL().startsWith(view.tab.url.toString())) {
            view.load(view.tab.url);
        }
    }

    load = () => {
        this.configServers.forEach((server) => this.loadServer(server));
    }

    reloadConfiguration = (configServers: TeamWithTabs[]) => {
        this.configServers = configServers.concat();
        const oldviews = this.views;
        this.views = new Map();
        const sorted = this.configServers.sort((a, b) => a.order - b.order);
        let setFocus;
        sorted.forEach((server) => {
            const srv = new MattermostServer(server.name, server.url);
            const serverInfo = new ServerInfo(srv);
            server.tabs.forEach((tab) => {
                const tabView = getServerView(srv, tab);
                const recycle = oldviews.get(tabView.name);
                if (recycle && recycle.name === this.currentView) {
                    setFocus = recycle.name;
                }
                if (!tab.isOpen) {
                    this.closedViews.set(tabView.name, {srv, tab});
                } else if (recycle && recycle.tab.name === tabView.name && recycle.tab.url.toString() === urlUtils.parseURL(tabView.url)!.toString()) {
                    oldviews.delete(recycle.name);
                    this.views.set(recycle.name, recycle);
                } else {
                    this.loadView(srv, serverInfo, tab);
                }
            });
        });
        if (this.currentView && (oldviews.has(this.currentView) || this.closedViews.has(this.currentView))) {
            if (configServers.length) {
                delete this.currentView;
                this.showInitial();
            } else {
                this.mainWindow.webContents.send(SET_ACTIVE_VIEW);
            }
        }
        oldviews.forEach((unused) => {
            unused.destroy();
        });
        if (setFocus) {
            this.showByName(setFocus);
        } else {
            this.showInitial();
        }
    }

    showInitial = () => {
        if (this.configServers.length) {
            const element = this.configServers.find((e) => e.order === this.lastActiveServer) || this.configServers.find((e) => e.order === 0);
            if (element && element.tabs.length) {
                let tab = element.tabs.find((tab) => tab.order === element.lastActiveTab) || element.tabs.find((tab) => tab.order === 0);
                if (!tab?.isOpen) {
                    const openTabs = element.tabs.filter((tab) => tab.isOpen);
                    tab = openTabs.find((e) => e.order === 0) || openTabs[0];
                }
                if (tab) {
                    const tabView = getTabViewName(element.name, tab.name);
                    this.showByName(tabView);
                }
            }
        }
    }

    showByName = (name: string) => {
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
            if (newView.needsLoadingScreen()) {
                this.showLoadingScreen();
            }
            newView.window.webContents.send(SET_ACTIVE_VIEW, newView.tab.server.name, newView.tab.type);
            ipcMain.emit(SET_ACTIVE_VIEW, true, newView.tab.server.name, newView.tab.type);
            if (newView.isReady()) {
                // if view is not ready, the renderer will have something to display instead.
                newView.show();
                ipcMain.emit(UPDATE_LAST_ACTIVE, true, newView.tab.server.name, newView.tab.type);
                if (newView.needsLoadingScreen()) {
                    this.showLoadingScreen();
                } else {
                    this.fadeLoadingScreen();
                }
            } else {
                log.warn(`couldn't show ${name}, not ready`);
                if (newView.needsLoadingScreen()) {
                    this.showLoadingScreen();
                }
            }
        } else {
            log.warn(`Couldn't find a view with name: ${name}`);
        }
        showModal();
    }

    focus = () => {
        if (isModalDisplayed()) {
            focusCurrentModal();
            return;
        }

        const view = this.getCurrentView();
        if (view) {
            view.focus();
        }
    }
    activateView = (viewName: string) => {
        if (this.currentView === viewName) {
            this.showByName(this.currentView);
        }
        const view = this.views.get(viewName);
        if (!view) {
            log.error(`Couldn't find a view with the name ${viewName}`);
            return;
        }
        addWebContentsEventListeners(view, this.getServers);
    }

    finishLoading = (server: string) => {
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
        this.closedViews.delete(name);
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

    failLoading = () => {
        this.fadeLoadingScreen();
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
        if (this.urlViewCancel) {
            this.urlViewCancel();
        }
        if (url && url !== '') {
            const urlString = typeof url === 'string' ? url : url.toString();
            const urlView = new BrowserView({
                webPreferences: {
                    nativeWindowOpen: true,
                    contextIsolation: process.env.NODE_ENV !== 'test',
                    nodeIntegration: process.env.NODE_ENV === 'test',
                }});
            const query = new Map([['url', urlString]]);
            const localURL = getLocalURLString('urlView.html', query);
            urlView.webContents.loadURL(localURL);
            this.mainWindow.addBrowserView(urlView);
            const boundaries = this.mainWindow.getBounds();
            urlView.setBounds({
                x: 0,
                y: boundaries.height - URL_VIEW_HEIGHT,
                width: Math.floor(boundaries.width / 3),
                height: URL_VIEW_HEIGHT,
            });

            const hideView = () => {
                delete this.urlViewCancel;
                this.mainWindow.removeBrowserView(urlView);

                // workaround to eliminate zombie processes
                // https://github.com/mattermost/desktop/pull/1519
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                urlView.webContents.destroy();
            };

            const timeout = setTimeout(hideView,
                URL_VIEW_DURATION);

            this.urlViewCancel = () => {
                clearTimeout(timeout);
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
            nativeWindowOpen: true,
            preload,
        }});
        const localURL = getLocalURLString('loadingScreen.html');
        this.loadingScreen.webContents.loadURL(localURL);
    }

    showLoadingScreen = () => {
        if (!this.loadingScreen) {
            this.createLoadingScreen();
        }

        this.loadingScreen!.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);

        if (this.mainWindow.getBrowserViews().includes(this.loadingScreen!)) {
            this.mainWindow.setTopBrowserView(this.loadingScreen!);
        } else {
            this.mainWindow.addBrowserView(this.loadingScreen!);
        }

        this.setLoadingScreenBounds();
    }

    fadeLoadingScreen = () => {
        if (this.loadingScreen) {
            this.loadingScreen.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, false);
        }
    }

    hideLoadingScreen = () => {
        if (this.loadingScreen) {
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
            const tabView = urlUtils.getView(parsedURL, this.configServers, true);
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

                    if (view.status === Status.READY && view.serverInfo.remoteInfo.serverVersion && Utils.isServerVersionGreaterThanOrEqualTo(view.serverInfo.remoteInfo.serverVersion, '6.0.0')) {
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
                dialog.showErrorBox('No matching server', `there is no configured server in the app that matches the requested url: ${parsedURL.toString()}`);
            }
        }
    };

    sendToAllViews = (channel: string, ...args: any[]) => {
        this.views.forEach((view) => view.view.webContents.send(channel, ...args));
    }
}
