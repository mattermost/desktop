// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {EventEmitter} from 'events';

import {
    BrowserView,
    BrowserViewConstructorOptions,
    BrowserWindow,
    CookiesSetDetails,
    HeadersReceivedResponse,
    ipcMain,
    IpcMainEvent,
    OnBeforeSendHeadersListenerDetails,
    OnHeadersReceivedListenerDetails,
    Rectangle,
    session,
} from 'electron';
import log from 'electron-log';

import {Headers} from 'types/webRequest';

import {GET_CURRENT_SERVER_URL, SETUP_INITIAL_COOKIES, SET_COOKIE} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import {TabView} from 'common/tabs/TabView';

import {ServerInfo} from 'main/server/serverInfo';
import {createCookieSetDetailsFromCookieString, getLocalPreload, getLocalURLString, makeCSPHeader} from 'main/utils';
import WebRequestManager from 'main/webRequest/webRequestManager';

export class MattermostView extends EventEmitter {
    // TODO
    name: string;
    tab: TabView;
    serverInfo: ServerInfo;
    window: BrowserWindow;
    view: BrowserView;
    isAtRoot: boolean;
    isVisible: boolean;
    isLoggedIn: boolean;

    cookies: CookiesSetDetails[];
    corsHeaders: string[];
    corsMethods: string[];

    constructor(tab: TabView, serverInfo: ServerInfo, window: BrowserWindow, options: BrowserViewConstructorOptions) {
        super();

        // TODO
        this.name = tab.name;
        this.tab = tab;
        this.serverInfo = serverInfo;
        this.window = window;
        this.isVisible = false;
        this.isLoggedIn = false;
        this.isAtRoot = false;

        const preload = getLocalPreload('mainWindow.js');
        this.view = new BrowserView({
            ...options,
            webPreferences: {
                preload,
            },
        });
        this.view.webContents.openDevTools({mode: 'detach'});

        // Don't cache the remote_entry script
        WebRequestManager.onRequestHeaders(this.addNoCacheForRemoteEntryRequest, this.view.webContents.id);

        // URL handling
        ipcMain.handle(GET_CURRENT_SERVER_URL, () => `${this.tab.server.url}`);
        WebRequestManager.rewriteURL(
            new RegExp(`mm-desktop://${this.tab.server.url.host}(${this.tab.server.url.pathname})?/(api|static|plugins)/(.*)`, 'g'),
            `${this.tab.server.url}/$2/$3`,
            this.view.webContents.id,
        );

        WebRequestManager.rewriteURL(
            new RegExp(`mm-desktop://${this.tab.server.url.host}${path.resolve('/').replace('\\', '/')}(\\?.+)?$`, 'g'),
            `${getLocalURLString('mattermost.html')}$1`,
            this.view.webContents.id,
        );

        WebRequestManager.onResponseHeaders(this.addCSPHeader, this.view.webContents.id);

        // Cookies
        this.cookies = [];
        ipcMain.handle(SETUP_INITIAL_COOKIES, this.setupCookies);
        ipcMain.on(SET_COOKIE, this.setCookie);
        WebRequestManager.onRequestHeaders(this.appendCookies, this.view.webContents.id);
        WebRequestManager.onResponseHeaders(this.extractCookies, this.view.webContents.id);

        // Websocket
        WebRequestManager.onRequestHeaders(this.addOriginForWebsocket, this.view.webContents.id);

        // CORS
        this.corsHeaders = [];
        this.corsMethods = [];
        WebRequestManager.onRequestHeaders(this.extractCORSHeaders, this.view.webContents.id);
        WebRequestManager.onResponseHeaders(this.addCORSResponseHeader, this.view.webContents.id);
    }

    private extractCORSHeaders = (details: OnBeforeSendHeadersListenerDetails) => {
        if (!details.url.match(new RegExp(`${this.tab.server.url.origin}/(.+)`))) {
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
        if (!details.url.match(new RegExp(`${this.tab.server.url.origin}/(.+)`))) {
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

    private addNoCacheForRemoteEntryRequest = (details: OnBeforeSendHeadersListenerDetails) => {
        log.silly('WindowManager.addNoCacheForRemoteEntry', details.requestHeaders);

        if (!details.url.match(new RegExp(`${this.tab.server.url}/static/remote_entry.js`))) {
            return {} as Headers;
        }

        return {
            requestHeaders: {
                'Cache-Control': 'max-age=0',
            },
        };
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

    private setCookie = async (event: IpcMainEvent, cookie: string) => {
        log.debug('Mattermost.setCookie', cookie);
        const cookieSetDetails = createCookieSetDetailsFromCookieString(cookie, `${this.tab.server.url}`, this.tab.server.url.host);
        await session.defaultSession.cookies.set(cookieSetDetails);
        this.cookies.push(cookieSetDetails);
    }

    private appendCookies = (details: OnBeforeSendHeadersListenerDetails) => {
        return {
            requestHeaders: {
                Cookie: `${details.requestHeaders.Cookie ? `${details.requestHeaders.Cookie}; ` : ''}${this.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')}`,
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
                const cookieResult = createCookieSetDetailsFromCookieString(cookie, `${this.tab.server.url}`, this.tab.server.url.host);
                this.cookies.push(cookieResult);

                session.defaultSession.cookies.set(cookieResult).then(() => {
                    return session.defaultSession.cookies.flushStore();
                }).catch((err) => {
                    log.error('An error occurring setting cookies', err);
                });
            });
        }
        return {};
    }

    private setupCookies = async () => {
        const cookies = await session.defaultSession.cookies.get({
            domain: this.tab.server.url.host,
            path: this.tab.server.url.pathname,
        });
        this.cookies = [...this.cookies, ...cookies.map((cookie) => ({
            ...cookie,
            url: `${this.tab.server.url}`,
        }))];
        return this.cookies;
    }

    private addCSPHeader = (details: OnHeadersReceivedListenerDetails) => {
        if (details.url === getLocalURLString('index.html')) {
            return {
                responseHeaders: {
                    'Content-Security-Policy': [makeCSPHeader(this.tab.server.url, this.serverInfo.remoteInfo.cspHeader)],
                },
            };
        }

        return {} as Headers;
    };

    load = (url?: string | URL) => {
        log.debug('MattermostView.load', `${url}`);

        // TODO
        const localURL = this.getLocalProtocolURL('index.html');
        this.view.webContents.loadURL(localURL);
    };

    getLocalProtocolURL = (urlPath: string) => {
        const localURL = getLocalURLString(urlPath);
        return localURL.replace(/file:\/\/\//, `mm-desktop://${this.tab.server.url.host}/`);
    }

    updateServerInfo = (srv: MattermostServer) => {
        log.debug('MattermostView.updateServerInfo', srv);

        // TODO
    };

    destroy = () => {
        log.debug('MattermostView.destroy');

        // TODO
    };

    isErrored = () => {
        log.debug('MattermostView.isErrored');

        // TODO
        return false;
    };

    isReady = () => {
        log.debug('MattermostView.isReady');

        // TODO
        return true;
    };

    reload = () => {
        log.debug('MattermostView.reload');

        // TODO
    };

    show = () => {
        log.debug('MattermostView.show');

        // TODO
        this.window.addBrowserView(this.view);
        this.view.setBounds({
            ...this.window.getBounds(),
            x: 0,
            y: 0,
        });
        this.isVisible = true;
    };

    hide = () => {
        log.debug('MattermostView.hide');

        // TODO
    };

    focus = () => {
        log.debug('MattermostView.focus');

        // TODO
    };

    setBounds = (bounds: Rectangle) => {
        log.debug('MattermostView.setBounds', bounds);

        // TODO
    };

    needsLoadingScreen = () => {
        log.debug('MattermostView.needsLoadingScreen');

        // TODO
        return false;
    };

    resetLoadingStatus = () => {
        log.debug('MattermostView.resetLoadingStatus');

        // TODO
    };

    setInitialized = () => {
        log.debug('MattermostView.setInitialized');

        // TODO
    };

    isInitialized = () => {
        log.debug('MattermostView.isInitialized');

        // TODO
        return true;
    };

    handleTitleUpdate = () => {
        log.debug('MattermostView.handleTitleUpdate');

        // TODO
    };

    handleFaviconUpdate = () => {
        log.debug('MattermostView.handleFaviconUpdate');

        // TODO
    };

    handleUpdateTarget = () => {
        log.debug('MattermostView.handleUpdateTarget');

        // TODO
    };

    handleDidNavigate = () => {
        log.debug('MattermostView.handleDidNavigate');

        // TODO
    };
}
