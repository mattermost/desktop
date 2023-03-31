// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';
import {BrowserWindow, ipcMain, IpcMainEvent, Rectangle} from 'electron';
import log from 'electron-log';

import {
    CallsJoinedCallMessage,
    CallsWidgetResizeMessage,
    CallsWidgetShareScreenMessage,
    CallsWidgetWindowConfig,
} from 'types/calls';

import {MattermostView} from 'main/views/MattermostView';

import {getLocalPreload} from 'main/utils';

import {CALLS_PLUGIN_ID, MINIMUM_CALLS_WIDGET_HEIGHT, MINIMUM_CALLS_WIDGET_WIDTH} from 'common/utils/constants';
import Utils from 'common/utils/util';
import urlUtils, {getFormattedPathName} from 'common/utils/url';
import {
    CALLS_JOINED_CALL,
    CALLS_POPOUT_FOCUS,
    CALLS_WIDGET_RESIZE,
    CALLS_WIDGET_SHARE_SCREEN,
} from 'common/communication';
import webContentsEventManager from 'main/views/webContentEvents';

type LoadURLOpts = {
    extraHeaders: string;
}

export default class CallsWidgetWindow extends EventEmitter {
    public win: BrowserWindow;
    private main: BrowserWindow;
    public popOut: BrowserWindow | null = null;
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

        // Calls widget window is not supposed to navigate anywhere else.
        this.win.webContents.on('will-navigate', this.onNavigate);
        this.win.webContents.on('did-start-navigation', this.onNavigate);

        this.load();
    }

    public async close() {
        log.debug('CallsWidgetWindow.close');
        return new Promise<void>((resolve) => {
            if (this.win.isDestroyed()) {
                resolve();
                return;
            }
            this.once('closed', resolve);
            this.win.close();
        });
    }

    public getServerName() {
        return this.mainView.serverInfo.server.name;
    }

    public getChannelURL() {
        return this.config.channelURL;
    }

    public getCallID() {
        return this.config.callID;
    }

    private onNavigate = (ev: Event, url: string) => {
        if (url === this.getWidgetURL()) {
            return;
        }
        log.warn(`CallsWidgetWindow: prevented widget window from navigating to: ${url}`);
        ev.preventDefault();
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
        const u = urlUtils.parseURL(this.mainView.serverInfo.server.url.toString()) as URL;
        u.pathname = getFormattedPathName(u.pathname);
        u.pathname += `plugins/${CALLS_PLUGIN_ID}/standalone/widget.html`;
        u.searchParams.append('call_id', this.config.callID);
        if (this.config.title) {
            u.searchParams.append('title', this.config.title);
        }
        if (this.config.rootID) {
            u.searchParams.append('root_id', this.config.rootID);
        }

        return u.toString();
    }

    private onResize = (ev: IpcMainEvent, _: string, msg: CallsWidgetResizeMessage) => {
        log.debug('CallsWidgetWindow.onResize', msg);

        if (!this.isAllowedEvent(ev)) {
            log.warn('CallsWidgetWindow.onResize', 'Disallowed calls event');
            return;
        }

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

    private onShareScreen = (ev: IpcMainEvent, _: string, message: CallsWidgetShareScreenMessage) => {
        log.debug('CallsWidgetWindow.onShareScreen');

        if (!this.isAllowedEvent(ev)) {
            log.warn('Disallowed calls event');
            return;
        }

        this.win.webContents.send(CALLS_WIDGET_SHARE_SCREEN, message);
    }

    private onJoinedCall = (ev: IpcMainEvent, _: string, message: CallsJoinedCallMessage) => {
        log.debug('CallsWidgetWindow.onJoinedCall');

        if (!this.isAllowedEvent(ev)) {
            log.warn('CallsWidgetWindow.onJoinedCall', 'Disallowed calls event');
            return;
        }

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

    private onPopOutOpen = ({url}: { url: string }) => {
        if (urlUtils.isCallsPopOutURL(this.mainView.serverInfo.server.url, url, this.config.callID)) {
            return {
                action: 'allow' as const,
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                },
            };
        }

        log.warn(`CallsWidgetWindow.onPopOutOpen: prevented window open to ${url}`);
        return {action: 'deny' as const};
    }

    private onPopOutCreate = (win: BrowserWindow) => {
        this.popOut = win;

        // Let the webContentsEventManager handle links that try to open a new window.
        webContentsEventManager.addWebContentsEventListeners(this.popOut.webContents);

        // Need to capture and handle redirects for security.
        this.popOut.webContents.on('will-redirect', this.onWillRedirect);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onWillRedirect = (event: Event, url: string) => {
        // There's no reason we would allow a redirect from the call's popout. Eventually we may, so revise then.
        // Note for the future: the code from https://github.com/mattermost/desktop/pull/2580 will not work for us.
        event.preventDefault();
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

    public getPopOutWebContentsId() {
        return this.popOut?.webContents.id;
    }

    public getURL() {
        return urlUtils.parseURL(this.win.webContents.getURL());
    }

    public getMainView() {
        return this.mainView;
    }

    public isAllowedEvent(event: IpcMainEvent) {
        // Only allow events coming from either the widget window or the
        // original Mattermost view that initiated it.
        return event.sender.id === this.getWebContentsId() ||
            event.sender.id === this.getMainView().getWebContents().id;
    }
}

