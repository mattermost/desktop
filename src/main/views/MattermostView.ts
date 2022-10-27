// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';

import {BrowserView, BrowserViewConstructorOptions, BrowserWindow, ipcMain, Rectangle} from 'electron';
import log from 'electron-log';

import {GET_CURRENT_SERVER_URL} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import {TabView} from 'common/tabs/TabView';

import {ServerInfo} from 'main/server/serverInfo';
import {getLocalPreload, getLocalURLString} from 'main/utils';
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

        log.info(this.tab.server);
        ipcMain.handle(GET_CURRENT_SERVER_URL, () => `${this.tab.server.url}`);
        WebRequestManager.rewriteURL(
            /^file:\/\/\/(.*)\/static/g,
            `${this.tab.server.url}/static`,
            this.view.webContents.id,
        );
        WebRequestManager.rewriteURL(
            /^file:\/\/\/(.*)\/api\/v4\/plugins\/(.+)/g,
            `${this.tab.server.url}/api/v4/plugins/$2`,
            this.view.webContents.id,
        );
        WebRequestManager.rewriteURL(
            /^file:\/\/\/(.*)\/plugins\/(.+)/g,
            `${this.tab.server.url}/plugins/$2`,
            this.view.webContents.id,
        );
        WebRequestManager.rewriteURL(
            /^file:\/\/\/(.*)\/api/g,
            `${this.tab.server.url}/api`,
            this.view.webContents.id,
        );
    }

    load = (url?: string | URL) => {
        log.info('MattermostView.load', url);
        // TODO
        const localURL = getLocalURLString('index.html');
        this.view.webContents.loadURL(localURL);
        this.view.webContents.openDevTools({mode: 'detach'});
    };

    updateServerInfo = (srv: MattermostServer) => {
        log.info('MattermostView.updateServerInfo', srv);
        // TODO
    };

    destroy = () => {
        log.info('MattermostView.destroy');
        // TODO
    };

    isErrored = () => {
        log.info('MattermostView.isErrored');
        // TODO
        return false;
    };

    isReady = () => {
        log.info('MattermostView.isReady');
        // TODO
        return true;
    };

    reload = () => {
        log.info('MattermostView.reload');
        // TODO
    };

    show = () => {
        log.info('MattermostView.show');
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
        log.info('MattermostView.hide');
        // TODO
    };

    focus = () => {
        log.info('MattermostView.focus');
        // TODO
    };

    setBounds = (bounds: Rectangle) => {
        log.info('MattermostView.setBounds');
        // TODO
    };

    needsLoadingScreen = () => {
        log.info('MattermostView.needsLoadingScreen');
        // TODO
        return false;
    };

    resetLoadingStatus = () => {
        log.info('MattermostView.resetLoadingStatus');
        // TODO
    };

    setInitialized = () => {
        log.info('MattermostView.setInitialized');
        // TODO
    };

    isInitialized = () => {
        log.info('MattermostView.isInitialized');
        // TODO
        return true;
    };

    handleTitleUpdate = () => {
        log.info('MattermostView.handleTitleUpdate');
        // TODO
    };

    handleFaviconUpdate = () => {
        log.info('MattermostView.handleFaviconUpdate');
        // TODO
    };

    handleUpdateTarget = () => {
        log.info('MattermostView.handleUpdateTarget');
        // TODO
    };

    handleDidNavigate = () => {
        log.info('MattermostView.handleDidNavigate');
        // TODO
    };
}
