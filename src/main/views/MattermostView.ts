// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, app} from 'electron';
import {BrowserViewConstructorOptions, Event, Input} from 'electron/main';

import {EventEmitter} from 'events';

import Util from 'common/utils/util';
import {RELOAD_INTERVAL, MAX_SERVER_RETRIES, SECOND, MAX_LOADING_SCREEN_SECONDS} from 'common/utils/constants';
import urlUtils from 'common/utils/url';
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
} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import {TabView, TabTuple} from 'common/tabs/TabView';
import logger from 'common/log';

import {ServerInfo} from 'main/server/serverInfo';

import ContextMenu from '../contextMenu';
import {getWindowBoundaries, getLocalPreload, composeUserAgent, shouldHaveBackBar} from '../utils';
import MainWindow from '../windows/mainWindow';
import WindowManager from '../windows/windowManager';
import * as appState from '../appState';

import WebContentsEventManager from './webContentEvents';

export enum Status {
    LOADING,
    READY,
    WAITING_MM,
    ERROR = -1,
}

const MENTIONS_GROUP = 2;
const log = logger.withPrefix('MattermostView');

export class MattermostView extends EventEmitter {
    tab: TabView;
    view: BrowserView;
    isVisible: boolean;
    isLoggedIn: boolean;
    isAtRoot: boolean;
    options: BrowserViewConstructorOptions;
    serverInfo: ServerInfo;

    removeLoading?: number;

    currentFavicon?: string;
    hasBeenShown: boolean;
    contextMenu: ContextMenu;

    status?: Status;
    retryLoad?: NodeJS.Timeout;
    maxRetries: number;

    private altPressStatus: boolean;

    constructor(tab: TabView, serverInfo: ServerInfo, options: BrowserViewConstructorOptions) {
        super();
        this.tab = tab;
        this.serverInfo = serverInfo;

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
        this.isLoggedIn = false;
        this.isAtRoot = true;
        this.view = new BrowserView(this.options);
        this.resetLoadingStatus();

        log.verbose(`BrowserView created for server ${this.tab.name}`);

        this.hasBeenShown = false;

        if (process.platform !== 'darwin') {
            this.view.webContents.on('before-input-event', this.handleInputEvents);
        }

        this.view.webContents.on('did-finish-load', () => {
            log.debug('did-finish-load', this.tab.name);

            // wait for screen to truly finish loading before sending the message down
            const timeout = setInterval(() => {
                if (!this.view.webContents) {
                    return;
                }

                if (!this.view.webContents.isLoading()) {
                    try {
                        this.view.webContents.send(SET_VIEW_OPTIONS, this.tab.name, this.tab.shouldNotify);
                        clearTimeout(timeout);
                    } catch (e) {
                        log.error('failed to send view options to view', this.tab.name);
                    }
                }
            }, 100);
        });

        this.contextMenu = new ContextMenu({}, this.view);
        this.maxRetries = MAX_SERVER_RETRIES;

        this.altPressStatus = false;

        MainWindow.get()?.on('blur', () => {
            this.altPressStatus = false;
        });
    }

    // use the same name as the server
    // TODO: we'll need unique identifiers if we have multiple instances of the same server in different tabs (1:N relationships)
    get name() {
        return this.tab.name;
    }

    get urlTypeTuple(): TabTuple {
        return this.tab.urlTypeTuple;
    }

    updateServerInfo = (srv: MattermostServer) => {
        this.tab.server = srv;
        this.serverInfo = new ServerInfo(srv);
        this.view.webContents.send(SET_VIEW_OPTIONS, this.tab.name, this.tab.shouldNotify);
    }

    resetLoadingStatus = () => {
        if (this.status !== Status.LOADING) { // if it's already loading, don't touch anything
            delete this.retryLoad;
            this.status = Status.LOADING;
            this.maxRetries = MAX_SERVER_RETRIES;
        }
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
                log.error('Cannot parse provided url, using current server url', someURL);
                loadURL = this.tab.url.toString();
            }
        } else {
            loadURL = this.tab.url.toString();
        }
        log.verbose(`[${Util.shorten(this.tab.name)}] Loading ${loadURL}`);
        const loading = this.view.webContents.loadURL(loadURL, {userAgent: composeUserAgent()});
        loading.then(this.loadSuccess(loadURL)).catch((err) => {
            if (err.code && err.code.startsWith('ERR_CERT')) {
                WindowManager.sendToRenderer(LOAD_FAILED, this.tab.name, err.toString(), loadURL.toString());
                this.emit(LOAD_FAILED, this.tab.name, err.toString(), loadURL.toString());
                log.info(`[${Util.shorten(this.tab.name)}] Invalid certificate, stop retrying until the user decides what to do: ${err}.`);
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

    retry = (loadURL: string) => {
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
                    WindowManager.sendToRenderer(LOAD_FAILED, this.tab.name, err.toString(), loadURL.toString());
                    this.emit(LOAD_FAILED, this.tab.name, err.toString(), loadURL.toString());
                    log.info(`[${Util.shorten(this.tab.name)}] Couldn't establish a connection with ${loadURL}: ${err}. Will continue to retry in the background.`);
                    this.status = Status.ERROR;
                    this.retryLoad = setTimeout(this.retryInBackground(loadURL), RELOAD_INTERVAL);
                }
            });
        };
    }

    retryInBackground = (loadURL: string) => {
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

    loadRetry = (loadURL: string, err: Error) => {
        this.retryLoad = setTimeout(this.retry(loadURL), RELOAD_INTERVAL);
        WindowManager.sendToRenderer(LOAD_RETRY, this.tab.name, Date.now() + RELOAD_INTERVAL, err.toString(), loadURL.toString());
        log.info(`[${Util.shorten(this.tab.name)}] failed loading ${loadURL}: ${err}, retrying in ${RELOAD_INTERVAL / SECOND} seconds`);
    }

    loadSuccess = (loadURL: string) => {
        return () => {
            log.verbose(`[${Util.shorten(this.tab.name)}] finished loading ${loadURL}`);
            WindowManager.sendToRenderer(LOAD_SUCCESS, this.tab.name);
            this.maxRetries = MAX_SERVER_RETRIES;
            if (this.status === Status.LOADING) {
                this.updateMentionsFromTitle(this.view.webContents.getTitle());
                this.findUnreadState(null);
            }
            this.status = Status.WAITING_MM;
            this.removeLoading = setTimeout(this.setInitialized, MAX_LOADING_SCREEN_SECONDS, true);
            this.emit(LOAD_SUCCESS, this.tab.name, loadURL);
            this.setBounds(getWindowBoundaries(MainWindow.get()!, shouldHaveBackBar(this.tab.url || '', this.view.webContents.getURL())));
        };
    }

    show = (requestedVisibility?: boolean) => {
        this.hasBeenShown = true;
        const request = typeof requestedVisibility === 'undefined' ? true : requestedVisibility;
        if (request && !this.isVisible) {
            MainWindow.get()?.addBrowserView(this.view);
            this.setBounds(getWindowBoundaries(MainWindow.get()!, shouldHaveBackBar(this.tab.url || '', this.view.webContents.getURL())));
            if (this.status === Status.READY) {
                this.focus();
            }
        } else if (!request && this.isVisible) {
            MainWindow.get()?.removeBrowserView(this.view);
        }
        this.isVisible = request;
    }

    reload = () => {
        this.resetLoadingStatus();
        this.load();
    }

    hide = () => this.show(false);

    openFind = () => {
        this.view.webContents.sendInputEvent({type: 'keyDown', keyCode: 'F', modifiers: [process.platform === 'darwin' ? 'cmd' : 'ctrl', 'shift']});
    }

    goToOffset = (offset: number) => {
        if (this.view.webContents.canGoToOffset(offset)) {
            try {
                this.view.webContents.goToOffset(offset);
                this.updateHistoryButton();
            } catch (error) {
                log.error(error);
                this.reload();
            }
        }
    }

    updateHistoryButton = () => {
        if (urlUtils.parseURL(this.view.webContents.getURL())?.toString() === this.tab.url.toString()) {
            this.view.webContents.clearHistory();
            this.isAtRoot = true;
        } else {
            this.isAtRoot = false;
        }
        this.view.webContents.send(BROWSER_HISTORY_BUTTON, this.view.webContents.canGoBack(), this.view.webContents.canGoForward());
    }

    setBounds = (boundaries: Electron.Rectangle) => {
        this.view.setBounds(boundaries);
    }

    destroy = () => {
        WebContentsEventManager.removeWebContentsListeners(this.view.webContents.id);
        appState.updateMentions(this.tab.name, 0, false);
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

    focus = () => {
        if (this.view.webContents) {
            this.view.webContents.focus();
        } else {
            log.warn('trying to focus the browserview, but it doesn\'t yet have webcontents.');
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
            log.info(`${this.tab.name} timeout expired will show the browserview`);
            this.emit(LOADSCREEN_END, this.tab.name);
        }
        clearTimeout(this.removeLoading);
        delete this.removeLoading;
    }

    isInitialized = () => {
        return this.status === Status.READY;
    }

    openDevTools = () => {
        this.view.webContents.openDevTools({mode: 'detach'});
    }

    getWebContents = () => {
        return this.view.webContents;
    }

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

    handleInputEvents = (_: Event, input: Input) => {
        log.silly('handleInputEvents', {tabName: this.tab.name, input});

        this.registerAltKeyPressed(input);

        if (this.isAltKeyReleased(input)) {
            MainWindow.focusThreeDotMenu();
        }
    }

    handleDidNavigate = (event: Event, url: string) => {
        log.debug('handleDidNavigate', {tabName: this.tab.name, url});

        if (shouldHaveBackBar(this.tab.url || '', url)) {
            this.setBounds(getWindowBoundaries(MainWindow.get()!, true));
            WindowManager.sendToRenderer(TOGGLE_BACK_BUTTON, true);
            log.info('show back button');
        } else {
            this.setBounds(getWindowBoundaries(MainWindow.get()!));
            WindowManager.sendToRenderer(TOGGLE_BACK_BUTTON, false);
            log.info('hide back button');
        }
    }

    handleUpdateTarget = (e: Event, url: string) => {
        log.silly('handleUpdateTarget', {tabName: this.tab.name, url});
        if (url && !urlUtils.isInternalURL(urlUtils.parseURL(url), this.tab.server.url)) {
            this.emit(UPDATE_TARGET_URL, url);
        } else {
            this.emit(UPDATE_TARGET_URL);
        }
    }

    titleParser = /(\((\d+)\) )?(\* )?/g

    handleTitleUpdate = (e: Event, title: string) => {
        log.debug('handleTitleUpdate', {tabName: this.tab.name, title});

        this.updateMentionsFromTitle(title);
    }

    updateMentionsFromTitle = (title: string) => {
        const resultsIterator = title.matchAll(this.titleParser);
        const results = resultsIterator.next(); // we are only interested in the first set
        const mentions = (results && results.value && parseInt(results.value[MENTIONS_GROUP], 10)) || 0;

        appState.updateMentions(this.tab.name, mentions);
    }

    handleFaviconUpdate = (e: Event, favicons: string[]) => {
        log.silly('handleFaviconUpdate', {tabName: this.tab.name, favicons});

        // if unread state is stored for that favicon, retrieve value.
        // if not, get related info from preload and store it for future changes
        this.currentFavicon = favicons[0];
        this.findUnreadState(favicons[0]);
    }

    // if favicon is null, it will affect appState, but won't be memoized
    findUnreadState = (favicon: string | null) => {
        try {
            this.view.webContents.send(IS_UNREAD, favicon, this.tab.name);
        } catch (err: any) {
            log.error(`There was an error trying to request the unread state: ${err}`);
            log.error(err.stack);
        }
    }
}
