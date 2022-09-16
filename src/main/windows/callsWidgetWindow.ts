// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';
import {BrowserWindow, Rectangle, ipcMain, IpcMainEvent} from 'electron';
import log from 'electron-log';

import {CallsWidgetWindowConfig, CallsWidgetResizeMessage} from 'types/calls';

import {getLocalPreload} from 'main/utils';

import {PRODUCTION} from 'common/utils/constants';
import Utils from 'common/utils/util';
import {
    CALLS_WIDGET_RESIZE,
} from 'common/communication';

type LoadURLOpts = {
    extraHeaders: string;
}

function boundsDiff(base: Rectangle, actual: Rectangle) {
    return {
        x: base.x - actual.x,
        y: base.y - actual.y,
        width: base.width - actual.width,
        height: base.height - actual.height,
    };
}

export default class CallsWidgetWindow extends EventEmitter {
    private win: BrowserWindow;
    private main: BrowserWindow;
    private config: CallsWidgetWindowConfig;
    private minWidth = 280;
    private minHeight = 86;
    private pluginID = 'com.mattermost.calls';
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

    constructor(mainWindow: BrowserWindow, config: CallsWidgetWindowConfig) {
        super();

        this.config = config;
        this.main = mainWindow;
        this.win = new BrowserWindow({
            width: this.minWidth,
            height: this.minHeight,
            minWidth: this.minWidth,
            minHeight: this.minHeight,
            title: 'Calls Widget',
            fullscreen: false,
            resizable: false,
            frame: false,
            transparent: true,
            show: false,
            alwaysOnTop: true,
            webPreferences: {
                preload: getLocalPreload('callsWidget.js'),
            },
        });

        this.win.once('ready-to-show', () => this.win.show());
        this.win.once('show', this.onShow);
        this.win.on('closed', this.onClosed);
        ipcMain.on(CALLS_WIDGET_RESIZE, this.onResize);

        this.load();
    }

    public close() {
        log.debug('CallsWidgetWindow.close');
        this.win.close();
    }

    private load() {
        const opts = {} as LoadURLOpts;
        if (Utils.runMode() !== PRODUCTION) {
            opts.extraHeaders = 'pragma: no-cache\n';
        }
        this.win.loadURL(this.getWidgetURL(), opts).catch((reason) => {
            log.error(`Calls widget window failed to load: ${reason}`);
        });
    }

    private onClosed = () => {
        log.debug('CallsWidgetWindow.onClosed');
        this.emit('closed');
        this.removeAllListeners('closed');
        ipcMain.off(CALLS_WIDGET_RESIZE, this.onResize);
    }

    private getWidgetURL() {
        return `${this.config.siteURL}/static/plugins/${this.pluginID}/widget/widget.html?call_id=${this.config.callID}`;
    }

    private onResize = (event: IpcMainEvent, msg: CallsWidgetResizeMessage) => {
        log.debug('CallsWidgetWindow.onResize');

        const currBounds = this.win.getBounds();

        switch (msg.element) {
        case 'calls-widget-audio-menu': {
            const newBounds = {
                x: currBounds.x,
                y: currBounds.y,
                width: msg.width > 0 ? currBounds.width + msg.width : this.minWidth,
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
                width: this.minWidth,
                height: this.minHeight + msg.height,
            };

            this.setBounds(newBounds);

            this.offsetsMap[msg.element].height = msg.height;

            break;
        }
        }
    }

    private setBounds(bounds: Rectangle) {
        // NOTE: this hack is needed to fix positioning on certain systems where
        // BrowserWindow.setBounds() is not consistent.
        bounds.x += this.boundsErr.x;
        bounds.y += this.boundsErr.y;
        bounds.height += this.boundsErr.height;
        bounds.width += this.boundsErr.width;

        this.win.setBounds(bounds);
        this.boundsErr = boundsDiff(bounds, this.win.getBounds());
    }

    private onShow = () => {
        log.debug('CallsWidgetWindow.onShow');

        this.win.focus();
        this.win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true});
        this.win.setAlwaysOnTop(true, 'screen-saver');

        const bounds = this.win.getBounds();
        const mainBounds = this.main.getBounds();
        const initialBounds = {
            x: mainBounds.x + 12,
            y: (mainBounds.y + mainBounds.height) - bounds.height - 12,
            width: this.minWidth,
            height: this.minHeight,
        };
        this.win.setBackgroundColor('#00ffffff');
        this.win.setMenuBarVisibility(false);

        if (process.env.MM_DEBUG_CALLS_WIDGET) {
            this.win.webContents.openDevTools({mode: 'detach'});
        }

        this.setBounds(initialBounds);
    }
}

