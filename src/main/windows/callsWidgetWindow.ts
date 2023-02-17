// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import url from 'url';
import {EventEmitter} from 'events';
import {BrowserWindow, Rectangle, ipcMain, IpcMainEvent} from 'electron';
import log from 'electron-log';

import {
    CallsWidgetWindowConfig,
    CallsWidgetResizeMessage,
    CallsWidgetShareScreenMessage,
    CallsJoinedCallMessage,
} from 'types/calls';

import {MattermostView} from 'main/views/MattermostView';

import {getLocalPreload} from 'main/utils';

import {
    MINIMUM_CALLS_WIDGET_WIDTH,
    MINIMUM_CALLS_WIDGET_HEIGHT,
    CALLS_PLUGIN_ID,
} from 'common/utils/constants';
import Utils from 'common/utils/util';
import urlUtils from 'common/utils/url';
import {
    CALLS_JOINED_CALL,
    CALLS_POPOUT_FOCUS,
    CALLS_WIDGET_RESIZE,
    CALLS_WIDGET_SHARE_SCREEN,
} from 'common/communication';
import webContentsEventManager from 'main/views/webContentEvents';
import Config from 'common/config';

type LoadURLOpts = {
    extraHeaders: string;
}

export default class CallsWidgetWindow extends EventEmitter {
    public win: BrowserWindow;
    private main: BrowserWindow;
    private popOut: BrowserWindow | null = null;
    private mainView: MattermostView;
    private config: CallsWidgetWindowConfig;
    private boundsErr: Rectangle = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    };

    constructor(mainWindow: BrowserWindow, mainView: MattermostView, config: CallsWidgetWindowConfig) {
        super();

        this.config = config;
        this.main = mainWindow;
        this.mainView = mainView;
        this.win = new BrowserWindow({
            width: MINIMUM_CALLS_WIDGET_WIDTH,
            height: MINIMUM_CALLS_WIDGET_HEIGHT,
            title: 'Calls Widget',
            fullscreen: false,
            resizable: false,
            frame: false,
            transparent: true,
            show: false,
            alwaysOnTop: true,
            backgroundColor: '#00ffffff',
            webPreferences: {
                preload: getLocalPreload('callsWidget.js'),
            },
        });

        this.win.once('ready-to-show', () => this.win.show());
        this.win.once('show', this.onShow);
        this.win.on('closed', this.onClosed);
        ipcMain.on(CALLS_WIDGET_RESIZE, this.onResize);
        ipcMain.on(CALLS_WIDGET_SHARE_SCREEN, this.onShareScreen);
        ipcMain.on(CALLS_JOINED_CALL, this.onJoinedCall);
        ipcMain.on(CALLS_POPOUT_FOCUS, this.onPopOutFocus);

        this.win.webContents.setWindowOpenHandler(this.onPopOutOpen);
        this.win.webContents.on('did-create-window', this.onPopOutCreate);

        this.load();
    }

    public close() {
        log.debug('CallsWidgetWindow.close');
        this.win.close();
    }

    public getServerName() {
        return this.config.serverName;
    }

    public getChannelURL() {
        return this.config.channelURL;
    }

    public getCallID() {
        return this.config.callID;
    }

    private load() {
        const opts = {} as LoadURLOpts;
        this.win.loadURL(this.getWidgetURL(), opts).catch((reason) => {
            log.error(`Calls widget window failed to load: ${reason}`);
        });
    }

    private onClosed = () => {
        log.debug('CallsWidgetWindow.onClosed');
        this.emit('closed');
        this.removeAllListeners('closed');
        ipcMain.off(CALLS_WIDGET_RESIZE, this.onResize);
        ipcMain.off(CALLS_WIDGET_SHARE_SCREEN, this.onShareScreen);
        ipcMain.off(CALLS_JOINED_CALL, this.onJoinedCall);
        ipcMain.off(CALLS_POPOUT_FOCUS, this.onPopOutFocus);
    }

    private getWidgetURL() {
        const u = new url.URL(this.config.siteURL);
        u.pathname += `/plugins/${CALLS_PLUGIN_ID}/standalone/widget.html`;
        u.searchParams.append('call_id', this.config.callID);
        if (this.config.title) {
            u.searchParams.append('title', this.config.title);
        }

        return u.toString();
    }

    private onResize = (event: IpcMainEvent, msg: CallsWidgetResizeMessage) => {
        log.debug('CallsWidgetWindow.onResize', msg);

        const zoomFactor = this.win.webContents.getZoomFactor();
        const currBounds = this.win.getBounds();
        const newBounds = {
            x: currBounds.x,
            y: currBounds.y - (Math.ceil(msg.height * zoomFactor) - currBounds.height),
            width: Math.ceil(msg.width * zoomFactor),
            height: Math.ceil(msg.height * zoomFactor),
        };

        this.setBounds(newBounds);
    }

    private onShareScreen = (ev: IpcMainEvent, viewName: string, message: CallsWidgetShareScreenMessage) => {
        this.win.webContents.send(CALLS_WIDGET_SHARE_SCREEN, message);
    }

    private onJoinedCall = (ev: IpcMainEvent, message: CallsJoinedCallMessage) => {
        this.mainView.view.webContents.send(CALLS_JOINED_CALL, message);
    }

    private setBounds(bounds: Rectangle) {
        // NOTE: this hack is needed to fix positioning on certain systems where
        // BrowserWindow.setBounds() is not consistent.
        bounds.x += this.boundsErr.x;
        bounds.y += this.boundsErr.y;
        bounds.height += this.boundsErr.height;
        bounds.width += this.boundsErr.width;

        this.win.setBounds(bounds);
        this.boundsErr = Utils.boundsDiff(bounds, this.win.getBounds());
    }

    private onShow = () => {
        log.debug('CallsWidgetWindow.onShow');

        this.win.focus();
        this.win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true, skipTransformProcessType: true});
        this.win.setAlwaysOnTop(true, 'screen-saver');

        const bounds = this.win.getBounds();
        const mainBounds = this.main.getBounds();
        const initialBounds = {
            x: mainBounds.x + 12,
            y: (mainBounds.y + mainBounds.height) - bounds.height - 12,
            width: MINIMUM_CALLS_WIDGET_WIDTH,
            height: MINIMUM_CALLS_WIDGET_HEIGHT,
        };
        this.win.setMenuBarVisibility(false);

        if (process.env.MM_DEBUG_CALLS_WIDGET) {
            this.win.webContents.openDevTools({mode: 'detach'});
        }

        this.setBounds(initialBounds);
    }

    private onPopOutOpen = () => {
        return {
            action: 'allow' as const,
            overrideBrowserWindowOptions: {
                autoHideMenuBar: true,
            },
        };
    }

    private onPopOutCreate = (win: BrowserWindow) => {
        this.popOut = win;

        // Let the webContentsEventManager handle links that try to open a new window
        const spellcheck = Config.useSpellChecker;
        const newWindow = webContentsEventManager.generateNewWindowListener(this.popOut.webContents.id, spellcheck);
        this.popOut.webContents.setWindowOpenHandler(newWindow);
    }

    private onPopOutFocus = () => {
        if (!this.popOut) {
            return;
        }
        if (this.popOut.isMinimized()) {
            this.popOut.restore();
        }
        this.popOut.focus();
    }

    public getWebContentsId() {
        return this.win.webContents.id;
    }

    public getURL() {
        return urlUtils.parseURL(this.win.webContents.getURL());
    }

    public getMainView() {
        return this.mainView;
    }
}

