// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';

import {
    app,
    BrowserView,
    BrowserViewConstructorOptions,
    BrowserWindow,
    CookiesSetDetails,
    HeadersReceivedResponse,
    ipcMain,
    IpcMainEvent,
    OnBeforeSendHeadersListenerDetails,
    OnHeadersReceivedListenerDetails,
    session,
    Event,
    Input,
} from 'electron';
import log from 'electron-log';

import {Headers} from 'types/webRequest';

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
import {
    createCookieSetDetailsFromCookieString,
    getLocalPreload,
    getLocalURLString,
    getWindowBoundaries,
    makeCSPHeader,
    composeUserAgent,
    shouldHaveBackBar,
} from 'main/utils';
import WebRequestManager from 'main/webRequest/webRequestManager';
import WindowManager from 'main/windows/windowManager';

import ContextMenu from '../contextMenu';
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

    cookies: Map<string, CookiesSetDetails>;
    corsHeaders: string[];
    corsMethods: string[];

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
        this.serverInfo = serverInfo;
        this.window = win;

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

        // URL handling
        WebRequestManager.rewriteURL(
            new RegExp(`^mm-desktop://${this.tab.server.url.host}(${this.tab.server.url.pathname})?/(api|static|plugins)/(.*)`, 'g'),
            `${this.tab.server.url}/$2/$3`,
            this.view.webContents.id,
        );

        WebRequestManager.onResponseHeaders(this.addCSPHeader, this.view.webContents.id);

        // Cookies
        this.cookies = new Map();
        WebRequestManager.onRequestHeaders(this.appendCookies, this.view.webContents.id);
        WebRequestManager.onResponseHeaders(this.extractCookies, this.view.webContents.id);

        // Websocket
        WebRequestManager.onRequestHeaders(this.addOriginForWebsocket, this.view.webContents.id);

        // CORS
        this.corsHeaders = [];
        this.corsMethods = [];
        WebRequestManager.onRequestHeaders(this.extractCORSHeaders, this.view.webContents.id);
        WebRequestManager.onResponseHeaders(this.addCORSResponseHeader, this.view.webContents.id);

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

    private extractCORSHeaders = (details: OnBeforeSendHeadersListenerDetails) => {
        if (!details.url.startsWith(this.tab.server.url.origin)) {
            return {} as Headers;
        }

        if (details.method !== 'OPTIONS') {
            return {} as Headers;
        }

        if (details.requestHeaders.Origin !== `mm-desktop://${this.tab.server.url.host}`) {
            return {} as Headers;
        }

        const headers = [...details.requestHeaders['Access-Control-Request-Headers'].split(',')];
        headers.forEach((header) => {
            if (!this.corsHeaders.includes(header)) {
                this.corsHeaders.push(header);
            }
        });
        if (!this.corsMethods.includes(details.requestHeaders['Access-Control-Request-Method'])) {
            this.corsMethods.push(details.requestHeaders['Access-Control-Request-Method']);
        }

        return {};
    }

    private addCORSResponseHeader = (details: OnHeadersReceivedListenerDetails): HeadersReceivedResponse => {
        if (!details.url.startsWith(this.tab.server.url.origin)) {
            return {};
        }

        if (details.method !== 'OPTIONS') {
            return {
                responseHeaders: {
                    'Access-Control-Allow-Credentials': ['true'],
                    'Access-Control-Allow-Origin': [`mm-desktop://${this.tab.server.url.host}`],
                },
            };
        }

        return {
            statusLine: 'HTTP/1.1 204 No Content',
            responseHeaders: {
                'Access-Control-Allow-Credentials': ['true'],
                'Access-Control-Allow-Headers': [...this.corsHeaders],
                'Access-Control-Allow-Origin': [`mm-desktop://${this.tab.server.url.host}`],
                'Access-Control-Allow-Methods': [...this.corsMethods],
            },
        };
    }

    get serverUrl() {
        let url = `${this.tab.server.url}`;
        if (url.endsWith('/')) {
            url = url.slice(0, url.length - 1);
        }
        return url;
    }

    private addOriginForWebsocket = (details: OnBeforeSendHeadersListenerDetails) => {
        log.silly('WindowManager.addOriginForWebsocket', details.requestHeaders);

        if (!details.url.startsWith('ws')) {
            return {} as Headers;
        }

        if (!(details.requestHeaders.Origin === 'file://')) {
            return {};
        }

        return {
            requestHeaders: {
                Origin: `${this.tab.server.url.protocol}//${this.tab.server.url.host}`,
            },
        };
    }

    setCookie = async (event: IpcMainEvent, cookie: string) => {
        log.debug('MattermostView.setCookie', this.tab.name, cookie);
        const cookieSetDetails = createCookieSetDetailsFromCookieString(cookie, `${this.tab.server.url}`, this.tab.server.url.host);
        if (this.cookies.has(cookieSetDetails.name) && this.cookies.get(cookieSetDetails.name)?.value === cookieSetDetails.value) {
            return;
        }
        await session.defaultSession.cookies.set(cookieSetDetails);
        this.cookies.set(cookieSetDetails.name, cookieSetDetails);
    }

    setupCookies = async () => {
        log.debug('MattermostView.setupCookies', this.tab.name);
        const cookies = await session.defaultSession.cookies.get({
            domain: this.tab.server.url.host,
            path: this.tab.server.url.pathname,
        });
        cookies.forEach((cookie) => {
            this.cookies.set(cookie.name, {
                ...cookie,
                url: `${this.serverUrl}`,
            });
        });
        return this.cookies;
    }

    private appendCookies = (details: OnBeforeSendHeadersListenerDetails) => {
        log.debug('MattermostView.appendCookies', details.requestHeaders, this.cookies);
        return {
            requestHeaders: {
                Cookie: `${details.requestHeaders.Cookie ? `${details.requestHeaders.Cookie}; ` : ''}${[...this.cookies.values()].map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')}`,
            },
        };
    }

    private extractCookies = (details: OnHeadersReceivedListenerDetails) => {
        if (!details.responseHeaders) {
            return {};
        }

        const cookieHeaderName = Object.keys(details.responseHeaders).find((key) => key.toLowerCase() === 'set-cookie');
        if (cookieHeaderName) {
            const cookies = details.responseHeaders[cookieHeaderName] as string[];
            cookies.forEach((cookie) => {
                const cookieResult = createCookieSetDetailsFromCookieString(cookie, `${this.serverUrl}`, this.tab.server.url.host);
                this.cookies.set(cookieResult.name, cookieResult);

                session.defaultSession.cookies.set(cookieResult).then(() => {
                    return session.defaultSession.cookies.flushStore();
                }).catch((err) => {
                    log.error('An error occurring setting cookies', err);
                });
            });
        }
        return {};
    }

    private addCSPHeader = (details: OnHeadersReceivedListenerDetails) => {
        if (details.url === this.convertURLToMMDesktop(this.tab.url).toString()) {
            return {
                responseHeaders: {
                    'Content-Security-Policy': [makeCSPHeader(this.tab.server.url, this.serverInfo.remoteInfo.cspHeader)],
                },
            };
        }

        return {} as Headers;
    };

    private convertURLToMMDesktop = (url: URL) => {
        return new URL(`${url}`.replace(/^http(s)?:/, 'mm-desktop:'));
    }

    load = (someURL?: URL | string) => {
        if (!this.tab) {
            return;
        }

        let loadURL: string;
        if (someURL) {
            const parsedURL = urlUtils.parseURL(someURL);
            if (parsedURL) {
                loadURL = this.convertURLToMMDesktop(parsedURL).toString();
            } else {
                log.error('Cannot parse provided url, using current server url', someURL);
                loadURL = this.convertURLToMMDesktop(this.tab.url).toString();
            }
        } else {
            loadURL = this.convertURLToMMDesktop(this.tab.url).toString();
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

    show = (requestedVisibility?: boolean) => {
        this.hasBeenShown = true;
        const request = typeof requestedVisibility === 'undefined' ? true : requestedVisibility;
        if (request && !this.isVisible) {
            this.window.addBrowserView(this.view);
            this.setBounds(getWindowBoundaries(this.window, shouldHaveBackBar(this.getLocalProtocolURL('mattermost.html'), this.view.webContents.getURL())));
            if (this.status === Status.READY) {
                this.focus();
            }
        } else if (!request && this.isVisible) {
            this.window.removeBrowserView(this.view);
        }
        this.isVisible = request;
    }

    // use the same name as the server
    // TODO: we'll need unique identifiers if we have multiple instances of the same server in different tabs (1:N relationships)
    get name() {
        return this.tab.name;
    }

    get urlTypeTuple(): TabTuple {
        return this.tab.urlTypeTuple;
    }

    getLocalProtocolURL = (urlPath: string) => {
        const localURL = getLocalURLString(urlPath);
        return localURL.replace(/file:\/\/\//, `mm-desktop://${this.tab.server.url.host}/`);
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
            this.setBounds(getWindowBoundaries(this.window, shouldHaveBackBar(this.getLocalProtocolURL('mattermost.html'), this.view.webContents.getURL())));
        };
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
        log.silly('MattermostView.handleInputEvents', {tabName: this.tab.name, input});

        this.registerAltKeyPressed(input);

        if (this.isAltKeyReleased(input)) {
            WindowManager.focusThreeDotMenu();
        }
    }

    handleDidNavigate = (event: Event, url: string) => {
        log.debug('MattermostView.handleDidNavigate', {tabName: this.tab.name, url});

        if (shouldHaveBackBar(this.getLocalProtocolURL('mattermost.html'), url)) {
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
        if (url && !urlUtils.isInternalURL(urlUtils.parseURL(url), this.tab.server.url) && !urlUtils.isInternalURL(urlUtils.parseURL(url), urlUtils.parseURL(this.getLocalProtocolURL('mattermost.html'))!)) {
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
