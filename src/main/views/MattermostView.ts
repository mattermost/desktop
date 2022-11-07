// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {EventEmitter} from 'events';

import {BrowserView, BrowserViewConstructorOptions, BrowserWindow, ipcMain, OnHeadersReceivedListenerDetails, Rectangle} from 'electron';
import log from 'electron-log';

import {Headers} from 'types/webRequest';

import {GET_CURRENT_SERVER_URL} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import {TabView} from 'common/tabs/TabView';

import {ServerInfo} from 'main/server/serverInfo';
import {getLocalPreload, getLocalURLString, makeCSPHeader} from 'main/utils';
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

    constructor(tab: TabView, serverInfo: ServerInfo, window: BrowserWindow, options: BrowserViewConstructorOptions) {
        super();

        // TODO
        this.name = tab.name;
        this.tab = tab;
        this.serverInfo = serverInfo;
        this.window = window;

        const preload = getLocalPreload('mainWindow.js');
        this.view = new BrowserView({
            ...options,
            webPreferences: {
                preload,
            },
        });
        this.isVisible = false;
        this.isLoggedIn = false;
        this.isAtRoot = false;

        ipcMain.handle(GET_CURRENT_SERVER_URL, () => `${this.tab.server.url}`);
        WebRequestManager.rewriteURL(
            new RegExp(`file:///${path.resolve('/').replace('\\', '/').replace('/', '')}(${this.tab.server.url.pathname})?/(api|static|plugins)/(.*)`, 'g'),
            `${this.tab.server.url}/$2/$3`,
            this.view.webContents.id,
        );

        WebRequestManager.onResponseHeaders(this.addCSPHeader, this.view.webContents.id);
    }

    addCSPHeader = (details: OnHeadersReceivedListenerDetails) => {
        if (details.url === getLocalURLString('index.html')) {
            return {
                'Content-Security-Policy': [makeCSPHeader(this.tab.server.url, this.serverInfo.remoteInfo.cspHeader)],
            };
        }

        return {} as Headers;
    };

    load = (url?: string | URL) => {
        log.debug('MattermostView.load', `${url}`);

        // TODO
        const localURL = getLocalURLString('index.html');
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
