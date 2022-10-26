// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, app, ipcMain, BrowserWindow} from 'electron';
import {BrowserViewConstructorOptions, Event, Input} from 'electron/main';
import log from 'electron-log';

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
    UNREAD_RESULT,
    TOGGLE_BACK_BUTTON,
    SET_VIEW_OPTIONS,
    LOADSCREEN_END,
} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import {TabView, TabTuple} from 'common/tabs/TabView';

import {ServerInfo} from 'main/server/serverInfo';
import ContextMenu from '../contextMenu';
import {getWindowBoundaries, getLocalPreload, composeUserAgent, shouldHaveBackBar} from '../utils';
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

export class MattermostView extends EventEmitter {
    tab: TabView;
    window: BrowserWindow;
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

    constructor(tab: TabView, serverInfo: ServerInfo, win: BrowserWindow, options: BrowserViewConstructorOptions) {
        super();
        this.tab = tab;
        this.window = win;
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

        log.info(`BrowserView created for server ${this.tab.name}`);

        this.hasBeenShown = false;

        if (process.platform !== 'darwin') {
            this.view.webContents.on('before-input-event', this.handleInputEvents);
        }

        this.view.webContents.on('did-finish-load', () => {
            log.debug('MattermostView.did-finish-load', this.tab.name);

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

        this.window.on('blur', () => {
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
        log.info(`[${Util.shorten(this.tab.name)}] Loading ${loadURL}`);
        const loading = this.view.webContents.loadURL(loadURL, {userAgent: composeUserAgent()});
        loading.then(this.loadSuccess(loadURL)).catch((err) => {
            if (err.code && err.code.startsWith('ERR_CERT')) {
                WindowManager.sendToRenderer(LOAD_FAILED, this.tab.name, err.toString(), loadURL.toString());
                this.emit(LOAD_FAILED, this.tab.name, err.toString(), loadURL.toString());
                log.info(`[${Util.shorten(this.tab.name)}] Invalid certificate, stop retrying until the user decides what to do: ${err}.`);
                this.status = Status.ERROR;
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
                    log.info(`[${Util.shorten(this.tab.name)}] Couldn't stablish a connection with ${loadURL}: ${err}. Will continue to retry in the background.`);
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
            log.info(`[${Util.shorten(this.tab.name)}] finished loading ${loadURL}`);
            WindowManager.sendToRenderer(LOAD_SUCCESS, this.tab.name);
            this.maxRetries = MAX_SERVER_RETRIES;
            if (this.status === Status.LOADING) {
                ipcMain.on(UNREAD_RESULT, this.handleFaviconIsUnread);
                this.updateMentionsFromTitle(this.view.webContents.getTitle());
                this.findUnreadState(null);
            }
            this.status = Status.WAITING_MM;
            this.removeLoading = setTimeout(this.setInitialized, MAX_LOADING_SCREEN_SECONDS, true);
            this.emit(LOAD_SUCCESS, this.tab.name, loadURL);
            this.setBounds(getWindowBoundaries(this.window, shouldHaveBackBar(this.tab.url || '', this.view.webContents.getURL())));
        };
    }

    show = (requestedVisibility?: boolean) => {
        this.hasBeenShown = true;
        const request = typeof requestedVisibility === 'undefined' ? true : requestedVisibility;
        if (request && !this.isVisible) {
            this.window.addBrowserView(this.view);
            this.setBounds(getWindowBoundaries(this.window, shouldHaveBackBar(this.tab.url || '', this.view.webContents.getURL())));
            if (this.status === Status.READY) {
                this.focus();
            }
        } else if (!request && this.isVisible) {
            this.window.removeBrowserView(this.view);
        }
        this.isVisible = request;
    }

    reload = () => {
        this.resetLoadingStatus();
        this.load();
    }

    hide = () => this.show(false);

    setBounds = (boundaries: Electron.Rectangle) => {
        this.view.setBounds(boundaries);
    }

    destroy = () => {
        WebContentsEventManager.removeWebContentsListeners(this.view.webContents.id);
        appState.updateMentions(this.tab.name, 0, false);
        if (this.window) {
            this.window.removeBrowserView(this.view);
        }

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
            log.warn('trying to focus the browserview, but it doesn\'t yet have webContents.');
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
        log.silly('MattermostView.handleInputEvents', {tabName: this.tab.name, input});

        this.registerAltKeyPressed(input);

        if (this.isAltKeyReleased(input)) {
            WindowManager.focusThreeDotMenu();
        }
    }

    handleDidNavigate = (event: Event, url: string) => {
        log.debug('MattermostView.handleDidNavigate', {tabName: this.tab.name, url});

        if (shouldHaveBackBar(this.tab.url || '', url)) {
            this.setBounds(getWindowBoundaries(this.window, true));
            WindowManager.sendToRenderer(TOGGLE_BACK_BUTTON, true);
            log.info('show back button');
        } else {
            this.setBounds(getWindowBoundaries(this.window));
            WindowManager.sendToRenderer(TOGGLE_BACK_BUTTON, false);
            log.info('hide back button');
        }
    }

    handleUpdateTarget = (e: Event, url: string) => {
        log.silly('MattermostView.handleUpdateTarget', {tabName: this.tab.name, url});
        if (url && !urlUtils.isInternalURL(urlUtils.parseURL(url), this.tab.server.url)) {
            this.emit(UPDATE_TARGET_URL, url);
        } else {
            this.emit(UPDATE_TARGET_URL);
        }
    }

    titleParser = /(\((\d+)\) )?(\* )?/g

    handleTitleUpdate = (e: Event, title: string) => {
        log.debug('MattermostView.handleTitleUpdate', {tabName: this.tab.name, title});

        this.updateMentionsFromTitle(title);
    }

    updateMentionsFromTitle = (title: string) => {
        const resultsIterator = title.matchAll(this.titleParser);
        const results = resultsIterator.next(); // we are only interested in the first set
        const mentions = (results && results.value && parseInt(results.value[MENTIONS_GROUP], 10)) || 0;

        appState.updateMentions(this.tab.name, mentions);
    }

    handleFaviconUpdate = (e: Event, favicons: string[]) => {
        log.silly('MattermostView.handleFaviconUpdate', {tabName: this.tab.name, favicons});

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

    // if favicon is null, it means it is the initial load,
    // so don't memoize as we don't have the favicons and there is no rush to find out.
    handleFaviconIsUnread = (e: Event, favicon: string, viewName: string, result: boolean) => {
        log.silly('MattermostView.handleFaviconIsUnread', {favicon, viewName, result});

        if (this.tab && viewName === this.tab.name) {
            appState.updateUnreads(viewName, result);
        }
    }
}
