// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {BrowserView, dialog, ipcMain, IpcMainEvent, IpcMainInvokeEvent} from 'electron';
import {BrowserViewConstructorOptions} from 'electron/main';

import {Tuple as tuple} from '@bloomberg/record-tuple-polyfill';

import {Tab, TeamWithTabs} from 'types/config';

import {SECOND, TAB_BAR_HEIGHT} from 'common/utils/constants';
import {
    UPDATE_TARGET_URL,
    LOAD_SUCCESS,
    LOAD_FAILED,
    LOADSCREEN_END,
    SET_ACTIVE_VIEW,
    OPEN_TAB,
    BROWSER_HISTORY_PUSH,
    UPDATE_LAST_ACTIVE,
    UPDATE_URL_VIEW_WIDTH,
    MAIN_WINDOW_SHOWN,
    RELOAD_CURRENT_VIEW,
    REACT_APP_INITIALIZED,
    APP_LOGGED_IN,
    BROWSER_HISTORY_BUTTON,
    APP_LOGGED_OUT,
    UNREAD_RESULT,
    GET_VIEW_NAME,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import urlUtils, {equalUrlsIgnoringSubpath} from 'common/utils/url';
import Utils from 'common/utils/util';
import {MattermostServer} from 'common/servers/MattermostServer';
import {getTabViewName, TabTuple, TabType, TAB_FOCALBOARD, TAB_MESSAGING, TAB_PLAYBOOKS} from 'common/tabs/TabView';
import MessagingTabView from 'common/tabs/MessagingTabView';
import FocalboardTabView from 'common/tabs/FocalboardTabView';
import PlaybooksTabView from 'common/tabs/PlaybooksTabView';

import {localizeMessage} from 'main/i18nManager';
import {ServerInfo} from 'main/server/serverInfo';
import MainWindow from 'main/windows/mainWindow';

import * as appState from '../appState';
import {getLocalURLString, getLocalPreload} from '../utils';

import {MattermostView} from './MattermostView';
import modalManager from './modalManager';
import WebContentsEventManager from './webContentEvents';
import LoadingScreen from './loadingScreen';

const log = new Logger('ViewManager');
const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 20;

export class ViewManager {
    private closedViews: Map<string, {srv: MattermostServer; tab: Tab}>;
    private views: Map<string, MattermostView>;
    private currentView?: string;

    private urlViewCancel?: () => void;

    private lastActiveServer?: number;
    private viewOptions: BrowserViewConstructorOptions;

    constructor() {
        this.lastActiveServer = Config.lastActiveTeam;
        this.viewOptions = {webPreferences: {spellcheck: Config.useSpellChecker}};
        this.views = new Map(); // keep in mind that this doesn't need to hold server order, only tabs on the renderer need that.
        this.closedViews = new Map();

        ipcMain.on(REACT_APP_INITIALIZED, this.handleReactAppInitialized);
        ipcMain.on(BROWSER_HISTORY_PUSH, this.handleBrowserHistoryPush);
        ipcMain.on(BROWSER_HISTORY_BUTTON, this.handleBrowserHistoryButton);
        ipcMain.on(APP_LOGGED_IN, this.handleAppLoggedIn);
        ipcMain.on(APP_LOGGED_OUT, this.handleAppLoggedOut);
        ipcMain.on(RELOAD_CURRENT_VIEW, this.handleReloadCurrentView);
        ipcMain.on(UNREAD_RESULT, this.handleFaviconIsUnread);
        ipcMain.handle(GET_VIEW_NAME, this.handleGetViewName);
    }

    init = () => {
        this.getServers().forEach((server) => this.loadServer(server));
        this.showInitial();
    }

    getView = (viewName: string) => {
        return this.views.get(viewName);
    }

    getCurrentView = () => {
        if (this.currentView) {
            return this.views.get(this.currentView);
        }

        return undefined;
    }

    getViewByWebContentsId = (webContentsId: number) => {
        return [...this.views.values()].find((view) => view.view.webContents.id === webContentsId);
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
                    LoadingScreen.show();
                }
            }
            MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW, newView.tab.server.name, newView.tab.type);
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

    focusCurrentView = () => {
        if (modalManager.isModalDisplayed()) {
            modalManager.focusCurrentModal();
            return;
        }

        const view = this.getCurrentView();
        if (view) {
            view.focus();
        }
    }

    reload = () => {
        const currentView = this.getCurrentView();
        if (currentView) {
            LoadingScreen.show();
            currentView.reload();
        }
    }

    sendToAllViews = (channel: string, ...args: unknown[]) => {
        this.views.forEach((view) => {
            if (!view.view.webContents.isDestroyed()) {
                view.view.webContents.send(channel, ...args);
            }
        });
    }

    sendToFind = () => {
        this.getCurrentView()?.openFind();
    }

    /**
     * Deep linking
     */

    handleDeepLink = (url: string | URL) => {
        // TODO: fix for new tabs
        if (url) {
            const parsedURL = urlUtils.parseURL(url)!;
            const tabView = this.getViewByURL(parsedURL, true);
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

    private deeplinkSuccess = (viewName: string) => {
        log.debug('deeplinkSuccess', viewName);

        const view = this.views.get(viewName);
        if (!view) {
            return;
        }
        this.showByName(viewName);
        view.removeListener(LOAD_FAILED, this.deeplinkFailed);
    };

    private deeplinkFailed = (viewName: string, err: string, url: string) => {
        log.error(`[${viewName}] failed to load deeplink ${url}: ${err}`);
        const view = this.views.get(viewName);
        if (!view) {
            return;
        }
        view.removeListener(LOAD_SUCCESS, this.deeplinkSuccess);
    }

    /**
     * View loading helpers
     */

    private loadServer = (server: TeamWithTabs) => {
        const srv = new MattermostServer(server.name, server.url);
        const serverInfo = new ServerInfo(srv);
        server.tabs.forEach((tab) => this.loadView(srv, serverInfo, tab));
    }

    private loadView = (srv: MattermostServer, serverInfo: ServerInfo, tab: Tab, url?: string) => {
        if (!tab.isOpen) {
            this.closedViews.set(getTabViewName(srv.name, tab.name), {srv, tab});
            return;
        }
        const view = this.makeView(srv, serverInfo, tab, url);
        this.addView(view);
    }

    private makeView = (srv: MattermostServer, serverInfo: ServerInfo, tab: Tab, url?: string): MattermostView => {
        const tabView = this.getServerView(srv, tab.name);
        const view = new MattermostView(tabView, serverInfo, this.viewOptions);
        view.once(LOAD_SUCCESS, this.activateView);
        view.load(url);
        view.on(UPDATE_TARGET_URL, this.showURLView);
        view.on(LOADSCREEN_END, this.finishLoading);
        view.on(LOAD_FAILED, this.failLoading);
        return view;
    }

    private addView = (view: MattermostView): void => {
        this.views.set(view.name, view);
        if (this.closedViews.has(view.name)) {
            this.closedViews.delete(view.name);
        }
    }

    private showInitial = () => {
        log.verbose('showInitial');

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
            MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW, null, null);
            ipcMain.emit(MAIN_WINDOW_SHOWN);
        }
    }

    /**
     * Mattermost view event handlers
     */

    private activateView = (viewName: string) => {
        log.debug('activateView', viewName);

        if (this.currentView === viewName) {
            this.showByName(this.currentView);
        }
        const view = this.views.get(viewName);
        if (!view) {
            log.error(`Couldn't find a view with the name ${viewName}`);
            return;
        }
        WebContentsEventManager.addMattermostViewEventListeners(view);
    }

    private finishLoading = (server: string) => {
        log.debug('finishLoading', server);

        const view = this.views.get(server);
        if (view && this.getCurrentView() === view) {
            this.showByName(this.currentView!);
            LoadingScreen.fade();
        }
    }

    private failLoading = (tabName: string) => {
        log.debug('failLoading', tabName);

        LoadingScreen.fade();
        if (this.currentView === tabName) {
            this.getCurrentView()?.hide();
        }
    }

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
            mainWindow.addBrowserView(urlView);
            const boundaries = this.views.get(this.currentView || '')?.view.getBounds() ?? mainWindow.getBounds();

            const hideView = () => {
                delete this.urlViewCancel;
                try {
                    mainWindow.removeBrowserView(urlView);
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

    /**
     * Event Handlers
     */

    /** Called when a new configuration is received
     * Servers or tabs have been added or edited. We need to
     * close, open, or reload tabs, taking care to reuse tabs and
     * preserve focus on the currently selected tab. */
    reloadConfiguration = () => {
        log.debug('reloadConfiguration');

        const focusedTuple: TabTuple | undefined = this.views.get(this.currentView as string)?.urlTypeTuple;

        const current: Map<TabTuple, MattermostView> = new Map();
        for (const view of this.views.values()) {
            current.set(view.urlTypeTuple, view);
        }

        const views: Map<TabTuple, MattermostView> = new Map();
        const closed: Map<TabTuple, {srv: MattermostServer; tab: Tab; name: string}> = new Map();

        const sortedTabs = this.getServers().flatMap((x) => [...x.tabs].
            sort((a, b) => a.order - b.order).
            map((t): [TeamWithTabs, Tab] => [x, t]));

        for (const [team, tab] of sortedTabs) {
            const srv = new MattermostServer(team.name, team.url);
            const info = new ServerInfo(srv);
            const tabTuple = tuple(new URL(team.url).href, tab.name as TabType);
            const recycle = current.get(tabTuple);
            if (!tab.isOpen) {
                const view = this.getServerView(srv, tab.name);
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
            if (this.getServers().length) {
                this.currentView = undefined;
                this.showInitial();
            } else {
                MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW);
            }
        }

        // show the focused tab (or initial)
        if (focusedTuple && views.has(focusedTuple)) {
            const view = views.get(focusedTuple);
            if (view) {
                this.currentView = view.name;
                this.showByName(view.name);
                MainWindow.get()?.webContents.send(SET_ACTIVE_VIEW, view.tab.server.name, view.tab.type);
            }
        } else {
            this.showInitial();
        }
    }

    private handleAppLoggedIn = (event: IpcMainEvent, viewName: string) => {
        log.debug('handleAppLoggedIn', viewName);

        const view = this.views.get(viewName);
        if (view && !view.isLoggedIn) {
            view.isLoggedIn = true;
            if (view.view.webContents.getURL() !== view.tab.url.toString() && !view.view.webContents.getURL().startsWith(view.tab.url.toString())) {
                view.load(view.tab.url);
            }
        }
    }

    private handleAppLoggedOut = (event: IpcMainEvent, viewName: string) => {
        log.debug('handleAppLoggedOut', viewName);

        const view = this.views.get(viewName);
        if (view && view.isLoggedIn) {
            view.isLoggedIn = false;
        }
    }

    private handleBrowserHistoryPush = (e: IpcMainEvent, viewName: string, pathName: string) => {
        log.debug('handleBrowserHistoryPush', {viewName, pathName});

        const currentView = this.views.get(viewName);
        const cleanedPathName = urlUtils.cleanPathName(currentView?.tab.server.url.pathname || '', pathName);
        const redirectedViewName = this.getViewByURL(`${currentView?.tab.server.url.toString().replace(/\/$/, '')}${cleanedPathName}`)?.name || viewName;
        if (this.closedViews.has(redirectedViewName)) {
            // If it's a closed view, just open it and stop
            this.openClosedTab(redirectedViewName, `${currentView?.tab.server.url}${cleanedPathName}`);
            return;
        }
        let redirectedView = this.views.get(redirectedViewName) || currentView;
        if (redirectedView !== currentView && redirectedView?.tab.name === this.currentView && redirectedView?.isLoggedIn) {
            log.info('redirecting to a new view', redirectedView?.name || viewName);
            this.showByName(redirectedView?.name || viewName);
        } else {
            redirectedView = currentView;
        }

        // Special case check for Channels to not force a redirect to "/", causing a refresh
        if (!(redirectedView !== currentView && redirectedView?.tab.type === TAB_MESSAGING && cleanedPathName === '/')) {
            redirectedView?.view.webContents.send(BROWSER_HISTORY_PUSH, cleanedPathName);
            if (redirectedView) {
                this.handleBrowserHistoryButton(e, redirectedView.name);
            }
        }
    }

    private handleBrowserHistoryButton = (e: IpcMainEvent, viewName: string) => {
        log.debug('handleBrowserHistoryButton', viewName);

        this.getView(viewName)?.updateHistoryButton();
    }

    private handleReactAppInitialized = (e: IpcMainEvent, viewName: string) => {
        log.debug('handleReactAppInitialized', viewName);

        const view = this.views.get(viewName);
        if (view) {
            view.setInitialized();
            if (this.getCurrentView() === view) {
                LoadingScreen.fade();
            }
        }
    }

    private handleReloadCurrentView = () => {
        log.debug('handleReloadCurrentView');

        const view = this.getCurrentView();
        if (!view) {
            return;
        }
        view?.reload();
        this.showByName(view?.name);
    }

    // if favicon is null, it means it is the initial load,
    // so don't memoize as we don't have the favicons and there is no rush to find out.
    private handleFaviconIsUnread = (e: Event, favicon: string, viewName: string, result: boolean) => {
        log.silly('handleFaviconIsUnread', {favicon, viewName, result});

        appState.updateUnreads(viewName, result);
    }

    /**
     * Helper functions
     */

    private openClosedTab = (name: string, url?: string) => {
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

    getViewByURL = (inputURL: URL | string, ignoreScheme = false) => {
        log.silly('getViewByURL', `${inputURL}`, ignoreScheme);

        const parsedURL = urlUtils.parseURL(inputURL);
        if (!parsedURL) {
            return undefined;
        }
        const server = this.getServers().find((team) => {
            const parsedServerUrl = urlUtils.parseURL(team.url)!;
            return equalUrlsIgnoringSubpath(parsedURL, parsedServerUrl, ignoreScheme) && parsedURL.pathname.match(new RegExp(`^${parsedServerUrl.pathname}(.+)?(/(.+))?$`));
        });
        if (!server) {
            return undefined;
        }

        const mmServer = new MattermostServer(server.name, server.url);
        let selectedTab = this.getServerView(mmServer, TAB_MESSAGING);
        server.tabs.
            filter((tab) => tab.name !== TAB_MESSAGING).
            forEach((tab) => {
                const tabCandidate = this.getServerView(mmServer, tab.name);
                if (parsedURL.pathname.match(new RegExp(`^${tabCandidate.url.pathname}(/(.+))?`))) {
                    selectedTab = tabCandidate;
                }
            });
        return selectedTab;
    }

    private getServerView = (srv: MattermostServer, tabName: string) => {
        switch (tabName) {
        case TAB_MESSAGING:
            return new MessagingTabView(srv);
        case TAB_FOCALBOARD:
            return new FocalboardTabView(srv);
        case TAB_PLAYBOOKS:
            return new PlaybooksTabView(srv);
        default:
            throw new Error('Not implemeneted');
        }
    }

    private getServers = () => {
        return Config.teams.concat();
    }

    handleGetViewName = (event: IpcMainInvokeEvent) => {
        return this.getViewByWebContentsId(event.sender.id);
    }

    setServerInitialized = (server: string) => {
        const view = this.views.get(server);
        if (view) {
            view.setInitialized();
            if (this.getCurrentView() === view) {
                LoadingScreen.fade();
            }
        }
    }
}

const viewManager = new ViewManager();
export default viewManager;
