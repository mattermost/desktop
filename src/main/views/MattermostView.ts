// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, app} from 'electron';
import {BrowserViewConstructorOptions, Event, Input} from 'electron/main';

import {EventEmitter} from 'events';

import {RELOAD_INTERVAL, MAX_SERVER_RETRIES, SECOND, MAX_LOADING_SCREEN_SECONDS} from 'common/utils/constants';
import urlUtils from 'common/utils/url';
import AppState from 'common/appState';
import {
    LOAD_RETRY,
    LOAD_SUCCESS,
    LOAD_FAILED,
    UPDATE_TARGET_URL,
    IS_UNREAD,
    TOGGLE_BACK_BUTTON,
    SET_VIEW_OPTIONS,
    LOADSCREEN_END,
    BROWSER_HISTORY_BUTTON,
    SERVERS_URL_MODIFIED,
} from 'common/communication';
import ServerManager from 'common/servers/serverManager';
import {Logger} from 'common/log';
import {TabView} from 'common/tabs/TabView';

import MainWindow from 'main/windows/mainWindow';

import ContextMenu from '../contextMenu';
import {getWindowBoundaries, getLocalPreload, composeUserAgent, shouldHaveBackBar} from '../utils';

import WebContentsEventManager from './webContentEvents';

enum Status {
    LOADING,
    READY,
    WAITING_MM,
    ERROR = -1,
}

const MENTIONS_GROUP = 2;
const titleParser = /(\((\d+)\) )?(\* )?/g;

export class MattermostView extends EventEmitter {
    tab: TabView;
    isVisible: boolean;

    private log: Logger;
    private view: BrowserView;
    private loggedIn: boolean;
    private atRoot: boolean;
    private options: BrowserViewConstructorOptions;
    private removeLoading?: number;
    private contextMenu: ContextMenu;
    private status?: Status;
    private retryLoad?: NodeJS.Timeout;
    private maxRetries: number;
    private altPressStatus: boolean;

    constructor(tab: TabView, options: BrowserViewConstructorOptions) {
        super();
        this.tab = tab;

        const preload = getLocalPreload('preload.js');
        this.options = Object.assign({}, options);
        this.options.webPreferences = {
            preload,
            additionalArguments: [
                `version=${app.getVersion()}`,
                `appName=${app.name}`,
            ],
            ...options.webPreferences,
        };
        this.isVisible = false;
        this.loggedIn = false;
        this.atRoot = true;
        this.view = new BrowserView(this.options);
        this.resetLoadingStatus();

        this.log = ServerManager.getViewLog(this.id, 'MattermostView');
        this.log.verbose('View created');

        this.view.webContents.on('did-finish-load', this.handleDidFinishLoad);
        this.view.webContents.on('page-title-updated', this.handleTitleUpdate);
        this.view.webContents.on('page-favicon-updated', this.handleFaviconUpdate);
        this.view.webContents.on('update-target-url', this.handleUpdateTarget);
        this.view.webContents.on('did-navigate', this.handleDidNavigate);
        if (process.platform !== 'darwin') {
            this.view.webContents.on('before-input-event', this.handleInputEvents);
        }

        WebContentsEventManager.addWebContentsEventListeners(this.view.webContents);

        this.contextMenu = new ContextMenu({}, this.view);
        this.maxRetries = MAX_SERVER_RETRIES;

        this.altPressStatus = false;

        MainWindow.get()?.on('blur', () => {
            this.altPressStatus = false;
        });

        ServerManager.on(SERVERS_URL_MODIFIED, this.handleServerWasModified);
    }

    get id() {
        return this.tab.id;
    }
    get isAtRoot() {
        return this.atRoot;
    }
    get isLoggedIn() {
        return this.loggedIn;
    }
    get currentURL() {
        return this.view.webContents.getURL();
    }
    get webContentsId() {
        return this.view.webContents.id;
    }

    onLogin = (loggedIn: boolean) => {
        if (this.isLoggedIn === loggedIn) {
            return;
        }

        this.loggedIn = loggedIn;

        // If we're logging in from a different tab, force a reload
        if (loggedIn &&
            this.currentURL !== this.tab.url.toString() &&
            !this.currentURL.startsWith(this.tab.url.toString())
        ) {
            this.reload();
        }
    }

    goToOffset = (offset: number) => {
        if (this.view.webContents.canGoToOffset(offset)) {
            try {
                this.view.webContents.goToOffset(offset);
                this.updateHistoryButton();
            } catch (error) {
                this.log.error(error);
                this.reload();
            }
        }
    }

    updateHistoryButton = () => {
        if (urlUtils.parseURL(this.currentURL)?.toString() === this.tab.url.toString()) {
            this.view.webContents.clearHistory();
            this.atRoot = true;
        } else {
            this.atRoot = false;
        }
        this.view.webContents.send(BROWSER_HISTORY_BUTTON, this.view.webContents.canGoBack(), this.view.webContents.canGoForward());
    }

    load = (someURL?: URL | string) => {
        if (!this.tab) {
            return;
        }

        let loadURL: string;
        if (someURL) {
            const parsedURL = urlUtils.parseURL(someURL);
            if (parsedURL) {
                loadURL = parsedURL.toString();
            } else {
                this.log.error('Cannot parse provided url, using current server url', someURL);
                loadURL = this.tab.url.toString();
            }
        } else {
            loadURL = this.tab.url.toString();
        }
        this.log.verbose(`Loading ${loadURL}`);
        const loading = this.view.webContents.loadURL(loadURL, {userAgent: composeUserAgent()});
        loading.then(this.loadSuccess(loadURL)).catch((err) => {
            if (err.code && err.code.startsWith('ERR_CERT')) {
                MainWindow.sendToRenderer(LOAD_FAILED, this.id, err.toString(), loadURL.toString());
                this.emit(LOAD_FAILED, this.id, err.toString(), loadURL.toString());
                this.log.info(`Invalid certificate, stop retrying until the user decides what to do: ${err}.`);
                this.status = Status.ERROR;
                return;
            }
            if (err.code && err.code.startsWith('ERR_ABORTED')) {
                // If the loading was aborted, we shouldn't be retrying
                return;
            }
            this.loadRetry(loadURL, err);
        });
    }

    show = () => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }
        if (this.isVisible) {
            return;
        }
        this.isVisible = true;
        mainWindow.addBrowserView(this.view);
        mainWindow.setTopBrowserView(this.view);
        this.setBounds(getWindowBoundaries(mainWindow, shouldHaveBackBar(this.tab.url || '', this.currentURL)));
        if (this.status === Status.READY) {
            this.focus();
        }
    }

    hide = () => {
        if (this.isVisible) {
            this.isVisible = false;
            MainWindow.get()?.removeBrowserView(this.view);
        }
    }

    reload = () => {
        this.resetLoadingStatus();
        this.load();
    }

    getBounds = () => {
        return this.view.getBounds();
    }

    openFind = () => {
        this.view.webContents.sendInputEvent({type: 'keyDown', keyCode: 'F', modifiers: [process.platform === 'darwin' ? 'cmd' : 'ctrl', 'shift']});
    }

    setBounds = (boundaries: Electron.Rectangle) => {
        this.view.setBounds(boundaries);
    }

    destroy = () => {
        WebContentsEventManager.removeWebContentsListeners(this.webContentsId);
        AppState.clear(this.id);
        MainWindow.get()?.removeBrowserView(this.view);

        // workaround to eliminate zombie processes
        // https://github.com/mattermost/desktop/pull/1519
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.view.webContents.destroy();

        this.isVisible = false;
        if (this.retryLoad) {
            clearTimeout(this.retryLoad);
        }
        if (this.removeLoading) {
            clearTimeout(this.removeLoading);
        }
    }

    /**
     * Status hooks
     */

    resetLoadingStatus = () => {
        if (this.status !== Status.LOADING) { // if it's already loading, don't touch anything
            delete this.retryLoad;
            this.status = Status.LOADING;
            this.maxRetries = MAX_SERVER_RETRIES;
        }
    }

    isReady = () => {
        return this.status === Status.READY;
    }

    isErrored = () => {
        return this.status === Status.ERROR;
    }

    needsLoadingScreen = () => {
        return !(this.status === Status.READY || this.status === Status.ERROR);
    }

    setInitialized = (timedout?: boolean) => {
        this.status = Status.READY;

        if (timedout) {
            this.log.verbose('timeout expired will show the browserview');
            this.emit(LOADSCREEN_END, this.id);
        }
        clearTimeout(this.removeLoading);
        delete this.removeLoading;
    }

    openDevTools = () => {
        this.view.webContents.openDevTools({mode: 'detach'});
    }

    /**
     * WebContents hooks
     */

    sendToRenderer = (channel: string, ...args: any[]) => {
        this.view.webContents.send(channel, ...args);
    }

    isDestroyed = () => {
        return this.view.webContents.isDestroyed();
    }

    focus = () => {
        if (this.view.webContents) {
            this.view.webContents.focus();
        } else {
            this.log.warn('trying to focus the browserview, but it doesn\'t yet have webcontents.');
        }
    }

    /**
     * ALT key handling for the 3-dot menu (Windows/Linux)
     */

    private registerAltKeyPressed = (input: Input) => {
        const isAltPressed = input.key === 'Alt' && input.alt === true && input.control === false && input.shift === false && input.meta === false;

        if (input.type === 'keyDown') {
            this.altPressStatus = isAltPressed;
        }

        if (input.key !== 'Alt') {
            this.altPressStatus = false;
        }
    };

    private isAltKeyReleased = (input: Input) => {
        return input.type === 'keyUp' && this.altPressStatus === true;
    };

    private handleInputEvents = (_: Event, input: Input) => {
        this.log.silly('handleInputEvents', input);

        this.registerAltKeyPressed(input);

        if (this.isAltKeyReleased(input)) {
            MainWindow.focusThreeDotMenu();
        }
    }

    /**
     * Unreads/mentions handlers
     */

    private updateMentionsFromTitle = (title: string) => {
        const resultsIterator = title.matchAll(titleParser);
        const results = resultsIterator.next(); // we are only interested in the first set
        const mentions = (results && results.value && parseInt(results.value[MENTIONS_GROUP], 10)) || 0;

        AppState.updateMentions(this.id, mentions);
    }

    // if favicon is null, it will affect appState, but won't be memoized
    private findUnreadState = (favicon: string | null) => {
        try {
            this.view.webContents.send(IS_UNREAD, favicon, this.id);
        } catch (err: any) {
            this.log.error('There was an error trying to request the unread state', err);
        }
    }

    private handleTitleUpdate = (e: Event, title: string) => {
        this.log.debug('handleTitleUpdate', title);

        this.updateMentionsFromTitle(title);
    }

    private handleFaviconUpdate = (e: Event, favicons: string[]) => {
        this.log.silly('handleFaviconUpdate', favicons);

        // if unread state is stored for that favicon, retrieve value.
        // if not, get related info from preload and store it for future changes
        this.findUnreadState(favicons[0]);
    }

    /**
     * Loading/retry logic
     */

    private retry = (loadURL: string) => {
        return () => {
            // window was closed while retrying
            if (!this.view || !this.view.webContents) {
                return;
            }
            const loading = this.view.webContents.loadURL(loadURL, {userAgent: composeUserAgent()});
            loading.then(this.loadSuccess(loadURL)).catch((err) => {
                if (this.maxRetries-- > 0) {
                    this.loadRetry(loadURL, err);
                } else {
                    MainWindow.sendToRenderer(LOAD_FAILED, this.id, err.toString(), loadURL.toString());
                    this.emit(LOAD_FAILED, this.id, err.toString(), loadURL.toString());
                    this.log.info(`Couldn't establish a connection with ${loadURL}, will continue to retry in the background`, err);
                    this.status = Status.ERROR;
                    this.retryLoad = setTimeout(this.retryInBackground(loadURL), RELOAD_INTERVAL);
                }
            });
        };
    }

    private retryInBackground = (loadURL: string) => {
        return () => {
            // window was closed while retrying
            if (!this.view || !this.view.webContents) {
                return;
            }
            const loading = this.view.webContents.loadURL(loadURL, {userAgent: composeUserAgent()});
            loading.then(this.loadSuccess(loadURL)).catch(() => {
                this.retryLoad = setTimeout(this.retryInBackground(loadURL), RELOAD_INTERVAL);
            });
        };
    }

    private loadRetry = (loadURL: string, err: Error) => {
        this.retryLoad = setTimeout(this.retry(loadURL), RELOAD_INTERVAL);
        MainWindow.sendToRenderer(LOAD_RETRY, this.id, Date.now() + RELOAD_INTERVAL, err.toString(), loadURL.toString());
        this.log.info(`failed loading ${loadURL}: ${err}, retrying in ${RELOAD_INTERVAL / SECOND} seconds`);
    }

    private loadSuccess = (loadURL: string) => {
        return () => {
            this.log.verbose(`finished loading ${loadURL}`);
            MainWindow.sendToRenderer(LOAD_SUCCESS, this.id);
            this.maxRetries = MAX_SERVER_RETRIES;
            if (this.status === Status.LOADING) {
                this.updateMentionsFromTitle(this.view.webContents.getTitle());
                this.findUnreadState(null);
            }
            this.status = Status.WAITING_MM;
            this.removeLoading = setTimeout(this.setInitialized, MAX_LOADING_SCREEN_SECONDS, true);
            this.emit(LOAD_SUCCESS, this.id, loadURL);
            const mainWindow = MainWindow.get();
            if (mainWindow) {
                this.setBounds(getWindowBoundaries(mainWindow, shouldHaveBackBar(this.tab.url || '', this.currentURL)));
            }
        };
    }

    /**
     * WebContents event handlers
     */

    private handleDidFinishLoad = () => {
        this.log.debug('did-finish-load');

        // wait for screen to truly finish loading before sending the message down
        const timeout = setInterval(() => {
            if (!this.view.webContents) {
                return;
            }

            if (!this.view.webContents.isLoading()) {
                try {
                    this.view.webContents.send(SET_VIEW_OPTIONS, this.id, this.tab.shouldNotify);
                    clearTimeout(timeout);
                } catch (e) {
                    this.log.error('failed to send view options to view');
                }
            }
        }, 100);
    }

    private handleDidNavigate = (event: Event, url: string) => {
        this.log.debug('handleDidNavigate', url);

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        if (shouldHaveBackBar(this.tab.url || '', url)) {
            this.setBounds(getWindowBoundaries(mainWindow, true));
            MainWindow.sendToRenderer(TOGGLE_BACK_BUTTON, true);
            this.log.debug('show back button');
        } else {
            this.setBounds(getWindowBoundaries(mainWindow));
            MainWindow.sendToRenderer(TOGGLE_BACK_BUTTON, false);
            this.log.debug('hide back button');
        }
    }

    private handleUpdateTarget = (e: Event, url: string) => {
        this.log.silly('handleUpdateTarget', url);
        if (url && !urlUtils.isInternalURL(urlUtils.parseURL(url), this.tab.server.url)) {
            this.emit(UPDATE_TARGET_URL, url);
        } else {
            this.emit(UPDATE_TARGET_URL);
        }
    }

    private handleServerWasModified = (serverIds: string) => {
        if (serverIds.includes(this.tab.server.id)) {
            this.reload();
        }
    }
}
