// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';
import {BrowserView, BrowserWindow, dialog} from 'electron';
import {BrowserViewConstructorOptions} from 'electron/main';

import {CombinedConfig, Team} from 'types/config';

import {SECOND} from 'common/utils/constants';
import {
    UPDATE_TARGET_URL,
    SET_SERVER_KEY,
    LOAD_SUCCESS,
    LOAD_FAILED,
    TOGGLE_LOADING_SCREEN_VISIBILITY,
    GET_LOADING_SCREEN_DATA,
    LOADSCREEN_END,
} from 'common/communication';
import urlUtils from 'common/utils/url';

import {MattermostServer} from '../MattermostServer';
import {getLocalURLString, getLocalPreload, getWindowBoundaries} from '../utils';

import {MattermostView} from './MattermostView';
import {showModal, isModalDisplayed, focusCurrentModal} from './modalManager';
import {addWebContentsEventListeners} from './webContentEvents';

const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 36;

export class ViewManager {
    configServers: Team[];
    viewOptions: BrowserViewConstructorOptions;
    views: Map<string, MattermostView>;
    currentView?: string;
    urlView?: BrowserView;
    urlViewCancel?: () => void;
    mainWindow: BrowserWindow;
    loadingScreen?: BrowserView;

    constructor(config: CombinedConfig, mainWindow: BrowserWindow) {
        this.configServers = config.teams;
        this.viewOptions = {webPreferences: {spellcheck: config.useSpellChecker}};
        this.views = new Map(); // keep in mind that this doesn't need to hold server order, only tabs on the renderer need that.
        this.mainWindow = mainWindow;
    }

    updateMainWindow = (mainWindow: BrowserWindow) => {
        this.mainWindow = mainWindow;
    }

    getServers = () => {
        return this.configServers;
    }

    loadServer = (server: Team) => {
        const srv = new MattermostServer(server.name, server.url);
        const view = new MattermostView(srv, this.mainWindow, this.viewOptions);
        this.views.set(server.name, view);
        if (!this.loadingScreen) {
            this.createLoadingScreen();
        }
        view.once(LOAD_SUCCESS, this.activateView);
        view.load();
        view.on(UPDATE_TARGET_URL, this.showURLView);
        view.on(LOADSCREEN_END, this.finishLoading);
        view.once(LOAD_FAILED, this.failLoading);
    }

    load = () => {
        this.configServers.forEach((server) => this.loadServer(server));
    }

    reloadConfiguration = (configServers: Team[]) => {
        this.configServers = configServers.concat();
        const oldviews = this.views;
        this.views = new Map();
        const sorted = this.configServers.sort((a, b) => a.order - b.order);
        let setFocus;
        sorted.forEach((server) => {
            const recycle = oldviews.get(server.name);
            if (recycle && recycle.isVisible) {
                setFocus = recycle.name;
            }
            if (recycle && recycle.server.name === server.name && recycle.server.url.toString() === urlUtils.parseURL(server.url)!.toString()) {
                oldviews.delete(recycle.name);
                this.views.set(recycle.name, recycle);
            } else {
                this.loadServer(server);
            }
        });
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
            const element = this.configServers.find((e) => e.order === 0);
            if (element) {
                this.showByName(element.name);
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
            const serverInfo = this.configServers.find((candidate) => candidate.name === newView.server.name);
            if (!serverInfo) {
                log.error(`Couldn't find a server in the config with the name ${newView.server.name}`);
                return;
            }
            newView.window.webContents.send(SET_SERVER_KEY, serverInfo.order);
            if (newView.isReady()) {
                // if view is not ready, the renderer will have something to display instead.
                newView.show();
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

    findByWebContent(webContentId: number) {
        let found = null;
        let serverName;
        let view;
        const entries = this.views.entries();

        for ([serverName, view] of entries) {
            if (typeof serverName !== 'undefined') {
                const wc = view.getWebContents();
                if (wc && wc.id === webContentId) {
                    found = serverName;
                }
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
                    contextIsolation: process.env.NODE_ENV !== 'test',
                    nodeIntegration: process.env.NODE_ENV === 'test',
                    enableRemoteModule: process.env.NODE_ENV === 'test',
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
            contextIsolation: true,
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

    deeplinkSuccess = (serverName: string) => {
        const view = this.views.get(serverName);
        if (!view) {
            return;
        }
        this.showByName(serverName);
        view.removeListener(LOAD_FAILED, this.deeplinkFailed);
    };

    deeplinkFailed = (serverName: string, err: string, url: string) => {
        log.error(`[${serverName}] failed to load deeplink ${url}: ${err}`);
        const view = this.views.get(serverName);
        if (!view) {
            return;
        }
        view.removeListener(LOAD_SUCCESS, this.deeplinkSuccess);
    }

    handleDeepLink = (url: string | URL) => {
        if (url) {
            const parsedURL = urlUtils.parseURL(url)!;
            const server = urlUtils.getServer(parsedURL, this.configServers, true);
            if (server) {
                const view = this.views.get(server.name);
                if (!view) {
                    log.error(`Couldn't find a view matching the name ${server.name}`);
                    return;
                }

                // attempting to change parsedURL protocol results in it not being modified.
                const urlWithSchema = `${view.server.url.origin}${parsedURL.pathname}${parsedURL.search}`;
                view.resetLoadingStatus();
                view.load(urlWithSchema);
                view.once(LOAD_SUCCESS, this.deeplinkSuccess);
                view.once(LOAD_FAILED, this.deeplinkFailed);
            } else {
                dialog.showErrorBox('No matching server', `there is no configured server in the app that matches the requested url: ${parsedURL.toString()}`);
            }
        }
    };

    sendToAllViews = (channel: string, ...args: any[]) => {
        this.views.forEach((view) => view.view.webContents.send(channel, ...args));
    }
}
