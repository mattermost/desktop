// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, Rectangle, Event, IpcMainInvokeEvent} from 'electron';
import {BrowserWindow, desktopCapturer, ipcMain, systemPreferences} from 'electron';

import ServerViewState from 'app/serverViewState';
import {
    BROWSER_HISTORY_PUSH,
    CALLS_ERROR,
    CALLS_JOIN_CALL,
    CALLS_JOIN_REQUEST,
    CALLS_JOINED_CALL,
    CALLS_LEAVE_CALL,
    CALLS_LINK_CLICK,
    CALLS_POPOUT_FOCUS,
    CALLS_WIDGET_RESIZE,
    CALLS_WIDGET_SHARE_SCREEN,
    CALLS_WIDGET_OPEN_THREAD,
    CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL,
    CALLS_WIDGET_OPEN_USER_SETTINGS,
    DESKTOP_SOURCES_MODAL_REQUEST,
    GET_DESKTOP_SOURCES,
    UPDATE_SHORTCUT_MENU,
} from 'common/communication';
import {Logger} from 'common/log';
import {CALLS_PLUGIN_ID, MINIMUM_CALLS_WIDGET_HEIGHT, MINIMUM_CALLS_WIDGET_WIDTH} from 'common/utils/constants';
import {getFormattedPathName, isCallsPopOutURL, parseURL} from 'common/utils/url';
import Utils from 'common/utils/util';
import performanceMonitor from 'main/performanceMonitor';
import PermissionsManager from 'main/permissionsManager';
import {
    composeUserAgent,
    getLocalPreload,
    openScreensharePermissionsSettingsMacOS,
    resetScreensharePermissionsMacOS,
} from 'main/utils';
import type {MattermostWebContentsView} from 'main/views/MattermostWebContentsView';
import ViewManager from 'main/views/viewManager';
import webContentsEventManager from 'main/views/webContentEvents';
import MainWindow from 'main/windows/mainWindow';

import type {
    CallsJoinCallMessage,
    CallsWidgetWindowConfig,
} from 'types/calls';

import ContextMenu from '../contextMenu';

const log = new Logger('CallsWidgetWindow');

export class CallsWidgetWindow {
    private win?: BrowserWindow;
    private mainView?: MattermostWebContentsView;
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
        ipcMain.on(CALLS_POPOUT_FOCUS, this.handlePopOutFocus);
        ipcMain.handle(GET_DESKTOP_SOURCES, this.handleGetDesktopSources);
        ipcMain.handle(CALLS_JOIN_CALL, this.handleCreateCallsWidgetWindow);
        ipcMain.on(CALLS_LEAVE_CALL, this.handleCallsLeave);

        // forwards to the main app
        ipcMain.on(DESKTOP_SOURCES_MODAL_REQUEST, this.forwardToMainApp(DESKTOP_SOURCES_MODAL_REQUEST));
        ipcMain.on(CALLS_ERROR, this.forwardToMainApp(CALLS_ERROR));
        ipcMain.on(CALLS_LINK_CLICK, this.handleCallsLinkClick);
        ipcMain.on(CALLS_JOIN_REQUEST, this.forwardToMainApp(CALLS_JOIN_REQUEST));
        ipcMain.on(CALLS_WIDGET_OPEN_THREAD, this.handleCallsOpenThread);
        ipcMain.on(CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL, this.handleCallsOpenStopRecordingModal);
        ipcMain.on(CALLS_WIDGET_OPEN_USER_SETTINGS, this.forwardToMainApp(CALLS_WIDGET_OPEN_USER_SETTINGS));
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

    public isOpen() {
        return Boolean(this.win && !this.win.isDestroyed());
    }

    public isPopoutOpen() {
        return Boolean(this.popOut && !this.popOut.isDestroyed());
    }

    /**
     * Helper functions
     */

    public openDevTools = () => {
        this.win?.webContents.openDevTools({mode: 'detach'});
    };

    public openPopoutDevTools = () => {
        this.popOut?.webContents.openDevTools({mode: 'detach'});
    };

    getViewURL = () => {
        return this.mainView?.view.server.url;
    };

    isCallsWidget = (webContentsId: number) => {
        return webContentsId === this.win?.webContents.id || webContentsId === this.popOut?.webContents.id;
    };

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
    };

    private init = (view: MattermostWebContentsView, options: CallsWidgetWindowConfig) => {
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
                preload: getLocalPreload('externalAPI.js'),
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
        performanceMonitor.registerView('CallsWidgetWindow', this.win.webContents);
        this.win?.loadURL(widgetURL, {
            userAgent: composeUserAgent(),
        }).catch((reason) => {
            log.error(`failed to load: ${reason}`);
        });
    };

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
            performanceMonitor.unregisterView(this.win.webContents.id);
            this.win?.close();
        });
    };

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

    /**
     * BrowserWindow/WebContents handlers
     */

    private onClosed = () => {
        ipcMain.emit(UPDATE_SHORTCUT_MENU);
        delete this.win;
        delete this.mainView;
        delete this.options;
    };

    private onNavigate = (ev: Event, url: string) => {
        if (url === this.getWidgetURL()) {
            return;
        }
        log.warn(`prevented widget window from navigating to: ${url}`);
        ev.preventDefault();
    };

    private setWidgetWindowStacking = ({onTop}: {onTop: boolean}) => {
        log.debug('setWidgetWindowStacking', onTop);

        if (!this.win) {
            return;
        }

        if (onTop) {
            this.win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true, skipTransformProcessType: true});
            this.win.setAlwaysOnTop(true, 'screen-saver');
            this.win.focus();
        } else {
            this.win.setAlwaysOnTop(false);
            this.win.setVisibleOnAllWorkspaces(false);
        }
    };

    private onShow = () => {
        log.debug('onShow');
        const mainWindow = MainWindow.get();
        if (!(this.win && mainWindow)) {
            return;
        }

        this.setWidgetWindowStacking({onTop: true});

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
            this.openDevTools();
        }

        ipcMain.emit(UPDATE_SHORTCUT_MENU);

        this.setBounds(initialBounds);
    };

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
                    webPreferences: {
                        preload: getLocalPreload('externalAPI.js'),
                    },
                },
            };
        }

        log.warn(`onPopOutOpen: prevented window open to ${url}`);
        return {action: 'deny' as const};
    };

    private onPopOutCreate = (win: BrowserWindow) => {
        this.popOut = win;

        this.setWidgetWindowStacking({onTop: false});

        // Let the webContentsEventManager handle links that try to open a new window.
        webContentsEventManager.addWebContentsEventListeners(this.popOut.webContents);

        // Need to capture and handle redirects for security.
        this.popOut.webContents.on('will-redirect', (event: Event) => {
            // There's no reason we would allow a redirect from the call's popout. Eventually we may, so revise then.
            // Note for the future: the code from https://github.com/mattermost/desktop/pull/2580 will not work for us.
            event.preventDefault();
        });

        const contextMenu = new ContextMenu({}, this.popOut);
        contextMenu.reload();

        // Update menu to show the developer tools option for this window.
        ipcMain.emit(UPDATE_SHORTCUT_MENU);

        this.popOut.on('closed', () => {
            ipcMain.emit(UPDATE_SHORTCUT_MENU);
            delete this.popOut;
            contextMenu.dispose();
            this.setWidgetWindowStacking({onTop: true});
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
    };

    /************************
     * IPC HANDLERS
     ************************/

    private handleResize = (ev: IpcMainEvent, width: number, height: number) => {
        log.debug('handleResize', width, height);

        if (!this.win) {
            return;
        }

        if (!this.isCallsWidget(ev.sender.id)) {
            log.debug('handleResize', 'Disallowed calls event');
            return;
        }

        const zoomFactor = this.win.webContents.getZoomFactor();
        const currBounds = this.win.getBounds();
        const newBounds = {
            x: currBounds.x,
            y: currBounds.y - (Math.ceil(height * zoomFactor) - currBounds.height),
            width: Math.ceil(width * zoomFactor),
            height: Math.ceil(height * zoomFactor),
        };

        this.setBounds(newBounds);
    };

    private handleShareScreen = (ev: IpcMainEvent, sourceID: string, withAudio: boolean) => {
        log.debug('handleShareScreen', {sourceID, withAudio});

        if (this.mainView?.webContentsId !== ev.sender.id) {
            log.debug('handleShareScreen', 'blocked on wrong webContentsId');
            return;
        }

        this.win?.webContents.send(CALLS_WIDGET_SHARE_SCREEN, sourceID, withAudio);
    };

    private handlePopOutFocus = () => {
        if (!this.popOut) {
            return;
        }
        if (this.popOut.isMinimized()) {
            this.popOut.restore();
        }
        this.popOut.focus();
    };

    private handleGetDesktopSources = async (event: IpcMainInvokeEvent, opts: Electron.SourcesOptions) => {
        log.debug('handleGetDesktopSources', opts);

        // For Calls we make an extra check to ensure the event is coming from the expected window (main view).
        // Otherwise we want to allow for other plugins to ask for screen sharing sources.
        if (this.mainView && event.sender.id !== this.mainView.webContentsId) {
            throw new Error('handleGetDesktopSources: blocked on wrong webContentsId');
        }

        const view = ViewManager.getViewByWebContentsId(event.sender.id);
        if (!view) {
            throw new Error('handleGetDesktopSources: view not found');
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

        if (!await PermissionsManager.doPermissionRequest(view.webContentsId, 'screenShare', {requestingUrl: view.view.server.url.toString(), isMainFrame: false})) {
            throw new Error('permissions denied');
        }

        const screenPermissionsErrArgs = ['screen-permissions', this.callID];

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
                throw new Error('handleGetDesktopSources: permissions denied');
            }

            const message = sources.map((source) => {
                return {
                    id: source.id,
                    name: source.name,
                    thumbnailURL: source.thumbnail.toDataURL(),
                };
            });

            return message;
        }).catch((err) => {
            // Only send calls error if this window has been initialized (i.e. we are in a call).
            // The rest of the logic is shared so that other plugins can request screen sources.
            if (this.callID) {
                view.sendToRenderer(CALLS_ERROR, ...screenPermissionsErrArgs);
                this.win?.webContents.send(CALLS_ERROR, ...screenPermissionsErrArgs);
            }

            throw new Error(`handleGetDesktopSources: desktopCapturer.getSources failed: ${err}`);
        });
    };

    private handleCreateCallsWidgetWindow = async (event: IpcMainInvokeEvent, msg: CallsJoinCallMessage) => {
        log.debug('createCallsWidgetWindow');

        // trying to join again the call we are already in should not be allowed.
        if (this.options?.callID === msg.callID) {
            return Promise.resolve();
        }

        // to switch from one call to another we need to wait for the existing
        // window to be fully closed.
        await this.close();

        const currentView = ViewManager.getViewByWebContentsId(event.sender.id);
        if (!currentView) {
            log.error('unable to create calls widget window: currentView is missing');
            return Promise.resolve();
        }

        const promise = new Promise((resolve) => {
            const connected = (ev: IpcMainEvent, incomingCallId: string, incomingSessionId: string) => {
                log.debug('onJoinedCall', incomingCallId);

                if (!this.isCallsWidget(ev.sender.id)) {
                    log.debug('onJoinedCall', 'blocked on wrong webContentsId');
                    return;
                }

                if (msg.callID !== incomingCallId) {
                    log.debug('onJoinedCall', 'blocked on wrong callId');
                    return;
                }

                ipcMain.off(CALLS_JOINED_CALL, connected);
                resolve({callID: msg.callID, sessionID: incomingSessionId});
            };
            ipcMain.on(CALLS_JOINED_CALL, connected);
        });

        this.init(currentView, {
            callID: msg.callID,
            title: msg.title,
            rootID: msg.rootID,
            channelURL: msg.channelURL,
        });

        return promise;
    };

    private handleCallsLeave = () => {
        log.debug('handleCallsLeave');

        this.close();
    };

    private focusChannelView() {
        if (!this.serverID || !this.mainView) {
            return;
        }

        ServerViewState.switchServer(this.serverID);
        MainWindow.get()?.focus();
        ViewManager.showById(this.mainView.id);
    }

    private forwardToMainApp = (channel: string) => {
        return (event: IpcMainEvent, ...args: any) => {
            log.debug('forwardToMainApp', channel, ...args);

            if (!this.isCallsWidget(event.sender.id)) {
                return;
            }

            if (!this.serverID) {
                return;
            }

            this.focusChannelView();
            this.mainView?.sendToRenderer(channel, ...args);
        };
    };

    private handleCallsOpenThread = (event: IpcMainEvent, threadID: string) => {
        this.forwardToMainApp(CALLS_WIDGET_OPEN_THREAD)(event, threadID);
    };

    private handleCallsOpenStopRecordingModal = (event: IpcMainEvent, channelID: string) => {
        this.forwardToMainApp(CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL)(event, channelID);
    };

    private handleCallsLinkClick = (event: IpcMainEvent, url: string) => {
        log.debug('handleCallsLinkClick', url);

        if (!this.isCallsWidget(event.sender.id)) {
            return;
        }

        if (!this.serverID) {
            return;
        }

        const parsedURL = parseURL(url);
        if (parsedURL) {
            ViewManager.handleDeepLink(parsedURL);
            return;
        }

        // If parsing above fails it means it's a relative path (e.g.
        // pointing to a channel).

        this.focusChannelView();
        this.mainView?.sendToRenderer(BROWSER_HISTORY_PUSH, url);
    };
}

const callsWidgetWindow = new CallsWidgetWindow();
export default callsWidgetWindow;
