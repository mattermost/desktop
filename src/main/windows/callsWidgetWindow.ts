// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, desktopCapturer, ipcMain, IpcMainEvent, Rectangle, systemPreferences, Event} from 'electron';

import {
    CallsErrorMessage,
    CallsEventHandler,
    CallsJoinCallMessage,
    CallsJoinedCallMessage,
    CallsJoinRequestMessage,
    CallsLinkClickMessage,
    CallsWidgetResizeMessage,
    CallsWidgetShareScreenMessage,
    CallsWidgetWindowConfig,
} from 'types/calls';

import ServerViewState from 'app/serverViewState';

import {Logger} from 'common/log';
import {CALLS_PLUGIN_ID, MINIMUM_CALLS_WIDGET_HEIGHT, MINIMUM_CALLS_WIDGET_WIDTH} from 'common/utils/constants';
import Utils from 'common/utils/util';
import {getFormattedPathName, isCallsPopOutURL, parseURL} from 'common/utils/url';
import {
    BROWSER_HISTORY_PUSH,
    CALLS_ERROR,
    CALLS_JOIN_CALL,
    CALLS_JOIN_REQUEST,
    CALLS_JOINED_CALL,
    CALLS_LEAVE_CALL,
    CALLS_LINK_CLICK,
    CALLS_POPOUT_FOCUS,
    CALLS_WIDGET_CHANNEL_LINK_CLICK,
    CALLS_WIDGET_RESIZE,
    CALLS_WIDGET_SHARE_SCREEN,
    DESKTOP_SOURCES_MODAL_REQUEST,
    DESKTOP_SOURCES_RESULT,
    DISPATCH_GET_DESKTOP_SOURCES,
} from 'common/communication';

import {MattermostBrowserView} from 'main/views/MattermostBrowserView';
import {
    composeUserAgent,
    getLocalPreload,
    openScreensharePermissionsSettingsMacOS,
    resetScreensharePermissionsMacOS,
} from 'main/utils';
import webContentsEventManager from 'main/views/webContentEvents';
import MainWindow from 'main/windows/mainWindow';
import ViewManager from 'main/views/viewManager';

const log = new Logger('CallsWidgetWindow');

export class CallsWidgetWindow {
    private win?: BrowserWindow;
    private mainView?: MattermostBrowserView;
    private options?: CallsWidgetWindowConfig;
    private missingScreensharePermissions?: boolean;

    private popOut?: BrowserWindow;
    private boundsErr: Rectangle = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    };

    constructor() {
        ipcMain.on(CALLS_WIDGET_RESIZE, this.handleResize);
        ipcMain.on(CALLS_WIDGET_SHARE_SCREEN, this.handleShareScreen);
        ipcMain.on(CALLS_JOINED_CALL, this.handleJoinedCall);
        ipcMain.on(CALLS_POPOUT_FOCUS, this.handlePopOutFocus);
        ipcMain.on(DISPATCH_GET_DESKTOP_SOURCES, this.genCallsEventHandler(this.handleGetDesktopSources));
        ipcMain.on(DESKTOP_SOURCES_MODAL_REQUEST, this.genCallsEventHandler(this.handleDesktopSourcesModalRequest));
        ipcMain.on(CALLS_JOIN_CALL, this.genCallsEventHandler(this.handleCreateCallsWidgetWindow));
        ipcMain.on(CALLS_LEAVE_CALL, this.genCallsEventHandler(this.handleCallsLeave));
        ipcMain.on(CALLS_WIDGET_CHANNEL_LINK_CLICK, this.genCallsEventHandler(this.handleCallsWidgetChannelLinkClick));
        ipcMain.on(CALLS_ERROR, this.genCallsEventHandler(this.handleCallsError));
        ipcMain.on(CALLS_LINK_CLICK, this.genCallsEventHandler(this.handleCallsLinkClick));
        ipcMain.on(CALLS_JOIN_REQUEST, this.genCallsEventHandler(this.handleCallsJoinRequest));
    }

    /**
     * Getters
     */

    get callID() {
        return this.options?.callID;
    }

    private get serverID() {
        return this.mainView?.view.server.id;
    }

    /**
     * Helper functions
     */

    getViewURL = () => {
        return this.mainView?.view.server.url;
    }

    isCallsWidget = (webContentsId: number) => {
        return webContentsId === this.win?.webContents.id || webContentsId === this.popOut?.webContents.id;
    }

    private getWidgetURL = () => {
        if (!this.mainView) {
            return undefined;
        }
        const u = parseURL(this.mainView.view.server.url.toString()) as URL;

        u.pathname = getFormattedPathName(u.pathname);
        u.pathname += `plugins/${CALLS_PLUGIN_ID}/standalone/widget.html`;

        if (this.options?.callID) {
            u.searchParams.append('call_id', this.options.callID);
        }
        if (this.options?.title) {
            u.searchParams.append('title', this.options.title);
        }
        if (this.options?.rootID) {
            u.searchParams.append('root_id', this.options.rootID);
        }

        return u.toString();
    }

    private init = (view: MattermostBrowserView, options: CallsWidgetWindowConfig) => {
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
            hasShadow: false,
            backgroundColor: '#00ffffff',
            webPreferences: {
                preload: getLocalPreload('callsWidget.js'),
            },
        });
        this.mainView = view;
        this.options = options;

        this.win.once('ready-to-show', () => this.win?.show());
        this.win.once('show', this.onShow);
        this.win.on('closed', this.onClosed);

        this.win.webContents.setWindowOpenHandler(this.onPopOutOpen);
        this.win.webContents.on('did-create-window', this.onPopOutCreate);

        // Calls widget window is not supposed to navigate anywhere else.
        this.win.webContents.on('will-navigate', this.onNavigate);
        this.win.webContents.on('did-start-navigation', this.onNavigate);

        const widgetURL = this.getWidgetURL();
        if (!widgetURL) {
            return;
        }
        this.win?.loadURL(widgetURL, {
            userAgent: composeUserAgent(),
        }).catch((reason) => {
            log.error(`failed to load: ${reason}`);
        });
    }

    private close = async () => {
        log.debug('close');
        if (!this.win) {
            return Promise.resolve();
        }
        if (this.win.isDestroyed()) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            if (!this.win) {
                resolve();
                return;
            }
            this.win?.on('closed', resolve);
            this.win?.close();
        });
    }

    private setBounds(bounds: Rectangle) {
        if (!this.win) {
            return;
        }

        // NOTE: this hack is needed to fix positioning on certain systems where
        // BrowserWindow.setBounds() is not consistent.
        bounds.x += this.boundsErr.x;
        bounds.y += this.boundsErr.y;
        bounds.height += this.boundsErr.height;
        bounds.width += this.boundsErr.width;

        this.win.setBounds(bounds);
        this.boundsErr = Utils.boundsDiff(bounds, this.win.getBounds());
    }

    private isAllowedEvent = (event: IpcMainEvent) => {
        // Allow events when a call isn't in progress
        if (!(this.win && this.mainView)) {
            return true;
        }

        // Only allow events coming from either the widget window or the
        // original Mattermost view that initiated it.
        return event.sender.id === this.win?.webContents.id ||
            event.sender.id === this.mainView?.webContentsId;
    }

    private genCallsEventHandler = (handler: CallsEventHandler) => {
        return (event: IpcMainEvent, viewId: string, msg?: any) => {
            if (!this.isAllowedEvent(event)) {
                log.warn('genCallsEventHandler', 'Disallowed calls event');
                return;
            }
            handler(viewId, msg);
        };
    }

    /**
     * BrowserWindow/WebContents handlers
     */

    private onClosed = () => {
        delete this.win;
        delete this.mainView;
        delete this.options;
    }

    private onNavigate = (ev: Event, url: string) => {
        if (url === this.getWidgetURL()) {
            return;
        }
        log.warn(`prevented widget window from navigating to: ${url}`);
        ev.preventDefault();
    }

    private onShow = () => {
        log.debug('onShow');
        const mainWindow = MainWindow.get();
        if (!(this.win && mainWindow)) {
            return;
        }

        this.win.focus();
        this.win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true, skipTransformProcessType: true});
        this.win.setAlwaysOnTop(true, 'screen-saver');

        const bounds = this.win.getBounds();
        const mainBounds = mainWindow.getBounds();
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
        if (!(this.mainView && this.options)) {
            return {action: 'deny' as const};
        }

        const parsedURL = parseURL(url);
        if (!parsedURL) {
            return {action: 'deny' as const};
        }
        if (isCallsPopOutURL(this.mainView?.view.server.url, parsedURL, this.options?.callID)) {
            return {
                action: 'allow' as const,
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                },
            };
        }

        log.warn(`onPopOutOpen: prevented window open to ${url}`);
        return {action: 'deny' as const};
    }

    private onPopOutCreate = (win: BrowserWindow) => {
        this.popOut = win;

        // Let the webContentsEventManager handle links that try to open a new window.
        webContentsEventManager.addWebContentsEventListeners(this.popOut.webContents);

        // Need to capture and handle redirects for security.
        this.popOut.webContents.on('will-redirect', (event: Event) => {
            // There's no reason we would allow a redirect from the call's popout. Eventually we may, so revise then.
            // Note for the future: the code from https://github.com/mattermost/desktop/pull/2580 will not work for us.
            event.preventDefault();
        });

        this.popOut.on('closed', () => {
            delete this.popOut;
        });

        // Set the userAgent so that the widget's popout is considered a desktop window in the webapp code.
        // 'did-frame-finish-load' is the earliest moment that allows us to call loadURL without throwing an error.
        // https://mattermost.atlassian.net/browse/MM-52756 is the proper fix for this.
        this.popOut.webContents.once('did-frame-finish-load', async () => {
            const url = this.popOut?.webContents.getURL() || '';
            if (!url) {
                return;
            }

            try {
                await this.popOut?.loadURL(url, {
                    userAgent: composeUserAgent(),
                });
            } catch (e) {
                log.error('did-frame-finish-load, failed to reload with correct userAgent', e);
            }
        });
    }

    /************************
     * IPC HANDLERS
     ************************/

    private handleResize = (ev: IpcMainEvent, _: string, msg: CallsWidgetResizeMessage) => {
        log.debug('onResize', msg);

        if (!this.win) {
            return;
        }

        if (!this.isAllowedEvent(ev)) {
            log.warn('onResize', 'Disallowed calls event');
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

    private handleShareScreen = (ev: IpcMainEvent, _: string, message: CallsWidgetShareScreenMessage) => {
        log.debug('handleShareScreen');

        if (!this.isAllowedEvent(ev)) {
            log.warn('Disallowed calls event');
            return;
        }

        this.win?.webContents.send(CALLS_WIDGET_SHARE_SCREEN, message);
    }

    private handleJoinedCall = (ev: IpcMainEvent, _: string, message: CallsJoinedCallMessage) => {
        log.debug('handleJoinedCall');

        if (!this.isAllowedEvent(ev)) {
            log.warn('handleJoinedCall', 'Disallowed calls event');
            return;
        }

        this.mainView?.sendToRenderer(CALLS_JOINED_CALL, message);
    }

    private handlePopOutFocus = () => {
        if (!this.popOut) {
            return;
        }
        if (this.popOut.isMinimized()) {
            this.popOut.restore();
        }
        this.popOut.focus();
    }

    private handleGetDesktopSources = async (viewId: string, opts: Electron.SourcesOptions) => {
        log.debug('handleGetDesktopSources', opts);

        const view = ViewManager.getView(viewId);
        if (!view) {
            log.error('handleGetDesktopSources: view not found');
            return Promise.resolve();
        }

        if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') === 'denied') {
            try {
                // If permissions are missing we reset them so that the system
                // prompt can be showed.
                await resetScreensharePermissionsMacOS();

                // We only open the system settings if permissions were already missing since
                // on the first attempt to get the sources the OS will correctly show a prompt.
                if (this.missingScreensharePermissions) {
                    await openScreensharePermissionsSettingsMacOS();
                }
                this.missingScreensharePermissions = true;
            } catch (err) {
                log.error('failed to reset screen sharing permissions', err);
            }
        }

        const screenPermissionsErrMsg = {err: 'screen-permissions'};

        return desktopCapturer.getSources(opts).then((sources) => {
            let hasScreenPermissions = true;
            if (systemPreferences.getMediaAccessStatus) {
                const screenPermissions = systemPreferences.getMediaAccessStatus('screen');
                log.debug('screenPermissions', screenPermissions);
                if (screenPermissions === 'denied') {
                    log.info('no screen sharing permissions');
                    hasScreenPermissions = false;
                }
            }

            if (!hasScreenPermissions || !sources.length) {
                log.info('missing screen permissions');
                view.sendToRenderer(CALLS_ERROR, screenPermissionsErrMsg);
                this.win?.webContents.send(CALLS_ERROR, screenPermissionsErrMsg);
                return;
            }

            const message = sources.map((source) => {
                return {
                    id: source.id,
                    name: source.name,
                    thumbnailURL: source.thumbnail.toDataURL(),
                };
            });

            if (message.length > 0) {
                view.sendToRenderer(DESKTOP_SOURCES_RESULT, message);
            }
        }).catch((err) => {
            log.error('desktopCapturer.getSources failed', err);

            view.sendToRenderer(CALLS_ERROR, screenPermissionsErrMsg);
            this.win?.webContents.send(CALLS_ERROR, screenPermissionsErrMsg);
        });
    }

    private handleCreateCallsWidgetWindow = async (viewId: string, msg: CallsJoinCallMessage) => {
        log.debug('createCallsWidgetWindow');

        // trying to join again the call we are already in should not be allowed.
        if (this.options?.callID === msg.callID) {
            return;
        }

        // to switch from one call to another we need to wait for the existing
        // window to be fully closed.
        await this.close();

        const currentView = ViewManager.getView(viewId);
        if (!currentView) {
            log.error('unable to create calls widget window: currentView is missing');
            return;
        }

        this.init(currentView, {
            callID: msg.callID,
            title: msg.title,
            rootID: msg.rootID,
            channelURL: msg.channelURL,
        });
    }

    private handleDesktopSourcesModalRequest = () => {
        log.debug('handleDesktopSourcesModalRequest');

        if (!this.serverID) {
            return;
        }

        ServerViewState.switchServer(this.serverID);
        MainWindow.get()?.focus();
        this.mainView?.sendToRenderer(DESKTOP_SOURCES_MODAL_REQUEST);
    }

    private handleCallsLeave = () => {
        log.debug('handleCallsLeave');

        this.close();
    }

    private handleCallsWidgetChannelLinkClick = () => {
        log.debug('handleCallsWidgetChannelLinkClick');

        if (!this.serverID) {
            return;
        }

        ServerViewState.switchServer(this.serverID);
        MainWindow.get()?.focus();
        this.mainView?.sendToRenderer(BROWSER_HISTORY_PUSH, this.options?.channelURL);
    }

    private handleCallsError = (_: string, msg: CallsErrorMessage) => {
        log.debug('handleCallsError', msg);

        if (!this.serverID) {
            return;
        }

        ServerViewState.switchServer(this.serverID);
        MainWindow.get()?.focus();
        this.mainView?.sendToRenderer(CALLS_ERROR, msg);
    }

    private handleCallsLinkClick = (_: string, msg: CallsLinkClickMessage) => {
        log.debug('handleCallsLinkClick with linkURL', msg.link);

        if (!this.serverID) {
            return;
        }

        ServerViewState.switchServer(this.serverID);
        MainWindow.get()?.focus();
        this.mainView?.sendToRenderer(BROWSER_HISTORY_PUSH, msg.link);
    }

    private handleCallsJoinRequest = (_: string, msg: CallsJoinRequestMessage) => {
        log.debug('handleCallsJoinRequest with callID', msg.callID);
        if (!this.serverID) {
            return;
        }

        ServerViewState.switchServer(this.serverID);
        MainWindow.get()?.focus();
        this.mainView?.sendToRenderer(CALLS_JOIN_REQUEST, msg);
    }
}

const callsWidgetWindow = new CallsWidgetWindow();
export default callsWidgetWindow;
