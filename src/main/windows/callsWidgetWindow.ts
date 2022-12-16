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
import {
    CALLS_WIDGET_RESIZE,
    CALLS_WIDGET_SHARE_SCREEN,
    CALLS_JOINED_CALL,
} from 'common/communication';

type LoadURLOpts = {
    extraHeaders: string;
}

export default class CallsWidgetWindow extends EventEmitter {
    public win: BrowserWindow;
    private main: BrowserWindow;
    private mainView: MattermostView;
    private config: CallsWidgetWindowConfig;
    private boundsErr: Rectangle = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    };
    private offsetsMap = {
        'calls-widget-menu': {
            height: 0,
        },
    };

    constructor(mainWindow: BrowserWindow, mainView: MattermostView, config: CallsWidgetWindowConfig) {
        super();

        this.config = config;
        this.main = mainWindow;
        this.mainView = mainView;
        this.win = new BrowserWindow({
            width: MINIMUM_CALLS_WIDGET_WIDTH,
            height: MINIMUM_CALLS_WIDGET_HEIGHT,
            minWidth: MINIMUM_CALLS_WIDGET_WIDTH,
            minHeight: MINIMUM_CALLS_WIDGET_HEIGHT,
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
        log.debug('CallsWidgetWindow.onResize');

        const currBounds = this.win.getBounds();

        switch (msg.element) {
        case 'calls-widget-audio-menu': {
            const newBounds = {
                x: currBounds.x,
                y: currBounds.y,
                width: msg.width > 0 ? currBounds.width + msg.width : MINIMUM_CALLS_WIDGET_WIDTH,
                height: currBounds.height,
            };

            this.setBounds(newBounds);

            break;
        }
        case 'calls-widget-menu': {
            const hOff = this.offsetsMap[msg.element].height;

            const newBounds = {
                x: currBounds.x,
                y: msg.height === 0 ? currBounds.y + hOff : currBounds.y - (msg.height - hOff),
                width: MINIMUM_CALLS_WIDGET_WIDTH,
                height: MINIMUM_CALLS_WIDGET_HEIGHT + msg.height,
            };

            this.setBounds(newBounds);

            this.offsetsMap[msg.element].height = msg.height;

            break;
        }
        }
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
}

