// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {EventEmitter} from 'events';

import {
    BrowserView,
    BrowserViewConstructorOptions,
    BrowserWindow,
    CookiesSetDetails,
    IpcMainEvent,
    OnBeforeSendHeadersListenerDetails,
    OnHeadersReceivedListenerDetails,
    Rectangle,
    session,
} from 'electron';
import log from 'electron-log';

import {Headers} from 'types/webRequest';

import {MattermostServer} from 'common/servers/MattermostServer';
import {TabView} from 'common/tabs/TabView';

import {ServerInfo} from 'main/server/serverInfo';
import {createCookieSetDetailsFromCookieString, getLocalPreload, getLocalURLString, getWindowBoundaries, makeCSPHeader} from 'main/utils';
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

    cookies: Map<string, CookiesSetDetails>;

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

        const preload = getLocalPreload('preload.js');
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
        WebRequestManager.rewriteURL(
            new RegExp(`file:///${path.resolve('/').replace('\\', '/').replace('/', '')}(${this.tab.server.url.pathname})?/(api|static|plugins)/(.*)`, 'g'),
            `${this.tab.server.url}/$2/$3`,
            this.view.webContents.id,
        );

        WebRequestManager.rewriteURL(
            new RegExp(`file://(${this.tab.server.url.pathname})?/(api|static|plugins)/(.*)`, 'g'),
            `${this.tab.server.url}/$2/$3`,
            this.view.webContents.id,
        );

        WebRequestManager.rewriteURL(
            new RegExp(`file:///${path.resolve('/').replace('\\', '/')}(\\?.+)?$`, 'g'),
            `${getLocalURLString('index.html')}$1`,
            this.view.webContents.id,
        );

        WebRequestManager.onResponseHeaders(this.addCSPHeader, this.view.webContents.id);

        // Cookies
        this.cookies = new Map();
        WebRequestManager.onRequestHeaders(this.appendCookies, this.view.webContents.id);
        WebRequestManager.onResponseHeaders(this.extractCookies, this.view.webContents.id);

        // Websocket
        WebRequestManager.onRequestHeaders(this.addOriginForWebsocket);
    }

    get serverUrl() {
        let url = `${this.tab.server.url}`;
        if (url.endsWith('/')) {
            url = url.slice(0, url.length - 1);
        }
        return url;
    }

    private addNoCacheForRemoteEntryRequest = (details: OnBeforeSendHeadersListenerDetails) => {
        log.silly('WindowManager.addNoCacheForRemoteEntry', details.requestHeaders);

        if (!details.url.match(new RegExp(`${this.serverUrl}/static/remote_entry.js`))) {
            return {} as Headers;
        }

        return {
            'Cache-Control': 'max-age=0',
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
            Origin: `${this.tab.server.url.protocol}//${this.tab.server.url.host}`,
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
            Cookie: `${details.requestHeaders.Cookie ? `${details.requestHeaders.Cookie}; ` : ''}${[...this.cookies.values()].map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')}`,
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
        if (details.url.startsWith(getLocalURLString('index.html'))) {
            return {
                'Content-Security-Policy': [makeCSPHeader(this.tab.server.url, this.serverInfo.remoteInfo.cspHeader)],
            };
        }

        return {} as Headers;
    };

    load = (url?: string | URL) => {
        log.debug('MattermostView.load', `${url}`);

        // TODO
        const localURL = getLocalURLString('mattermost.html');
        this.view.webContents.loadURL(localURL);
    };

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
        this.window.addBrowserView(this.view);
        this.setBounds(getWindowBoundaries(this.window));
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

        this.view.setBounds(bounds);
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
