// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import {BrowserWindow, systemPreferences, ipcMain, IpcMainEvent, desktopCapturer} from 'electron';

import {
    CallsJoinCallMessage,
    CallsErrorMessage,
    CallsLinkClickMessage,
    CallsEventHandler,
} from 'types/calls';

import {
    MAXIMIZE_CHANGE,
    GET_DARK_MODE,
    UPDATE_SHORTCUT_MENU,
    BROWSER_HISTORY_PUSH,
    RESIZE_MODAL,
    DISPATCH_GET_DESKTOP_SOURCES,
    DESKTOP_SOURCES_RESULT,
    VIEW_FINISHED_RESIZING,
    SERVERS_UPDATE,
    WINDOW_CLOSE,
    WINDOW_MAXIMIZE,
    WINDOW_MINIMIZE,
    WINDOW_RESTORE,
    DOUBLE_CLICK_ON_WINDOW,
    CALLS_JOIN_CALL,
    CALLS_LEAVE_CALL,
    DESKTOP_SOURCES_MODAL_REQUEST,
    CALLS_WIDGET_CHANNEL_LINK_CLICK,
    CALLS_ERROR,
    CALLS_LINK_CLICK,
} from 'common/communication';
import {Logger} from 'common/log';
import {SECOND} from 'common/utils/constants';
import Config from 'common/config';

import ServerManager from 'common/servers/serverManager';

import {
    getAdjustedWindowBoundaries,
    shouldHaveBackBar,
    resetScreensharePermissionsMacOS,
    openScreensharePermissionsSettingsMacOS,
} from '../utils';

import ViewManager from '../views/viewManager';
import LoadingScreen from '../views/loadingScreen';
import {MattermostView} from '../views/MattermostView';
import TeamDropdownView from '../views/teamDropdownView';
import DownloadsDropdownView from '../views/downloadsDropdownView';
import DownloadsDropdownMenuView from '../views/downloadsDropdownMenuView';

import MainWindow from './mainWindow';
import CallsWidgetWindow from './callsWidgetWindow';
import SettingsWindow from './settingsWindow';

// singleton module to manage application's windows

const log = new Logger('WindowManager');

export class WindowManager {
    private teamDropdown?: TeamDropdownView;
    private downloadsDropdown?: DownloadsDropdownView;
    private downloadsDropdownMenu?: DownloadsDropdownMenuView;

    callsWidgetWindow?: CallsWidgetWindow;

    private isResizing: boolean;
    private missingScreensharePermissions?: boolean;

    constructor() {
        this.isResizing = false;

        ipcMain.handle(GET_DARK_MODE, this.handleGetDarkMode);
        ipcMain.on(VIEW_FINISHED_RESIZING, this.handleViewFinishedResizing);
        ipcMain.on(WINDOW_CLOSE, this.handleClose);
        ipcMain.on(WINDOW_MAXIMIZE, this.handleMaximize);
        ipcMain.on(WINDOW_MINIMIZE, this.handleMinimize);
        ipcMain.on(WINDOW_RESTORE, this.handleRestore);
        ipcMain.on(DOUBLE_CLICK_ON_WINDOW, this.handleDoubleClick);

        ServerManager.on(SERVERS_UPDATE, this.handleUpdateConfig);

        // Calls handlers
        ipcMain.on(DISPATCH_GET_DESKTOP_SOURCES, this.genCallsEventHandler(this.handleGetDesktopSources));
        ipcMain.on(DESKTOP_SOURCES_MODAL_REQUEST, this.genCallsEventHandler(this.handleDesktopSourcesModalRequest));
        ipcMain.on(CALLS_JOIN_CALL, this.genCallsEventHandler(this.createCallsWidgetWindow));
        ipcMain.on(CALLS_LEAVE_CALL, this.genCallsEventHandler(this.handleCallsLeave));
        ipcMain.on(CALLS_WIDGET_CHANNEL_LINK_CLICK, this.genCallsEventHandler(this.handleCallsWidgetChannelLinkClick));
        ipcMain.on(CALLS_ERROR, this.genCallsEventHandler(this.handleCallsError));
        ipcMain.on(CALLS_LINK_CLICK, this.genCallsEventHandler(this.handleCallsLinkClick));
    }

    genCallsEventHandler = (handler: CallsEventHandler) => {
        return (event: IpcMainEvent, viewName: string, msg?: any) => {
            if (this.callsWidgetWindow && !this.callsWidgetWindow.isAllowedEvent(event)) {
                log.warn('genCallsEventHandler', 'Disallowed calls event');
                return;
            }
            handler(viewName, msg);
        };
    }

    createCallsWidgetWindow = async (viewName: string, msg: CallsJoinCallMessage) => {
        log.debug('createCallsWidgetWindow');
        if (this.callsWidgetWindow) {
            // trying to join again the call we are already in should not be allowed.
            if (this.callsWidgetWindow.getCallID() === msg.callID) {
                return;
            }

            // to switch from one call to another we need to wait for the existing
            // window to be fully closed.
            await this.callsWidgetWindow.close();
        }
        const currentView = ViewManager.getView(viewName);
        if (!currentView) {
            log.error('unable to create calls widget window: currentView is missing');
            return;
        }

        this.callsWidgetWindow = new CallsWidgetWindow(MainWindow.get()!, currentView, {
            callID: msg.callID,
            title: msg.title,
            rootID: msg.rootID,
            channelURL: msg.channelURL,
        });

        this.callsWidgetWindow.on('closed', () => delete this.callsWidgetWindow);
    }

    handleDesktopSourcesModalRequest = () => {
        log.debug('handleDesktopSourcesModalRequest');

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerName());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().sendToRenderer(DESKTOP_SOURCES_MODAL_REQUEST);
        }
    }

    handleCallsWidgetChannelLinkClick = () => {
        log.debug('handleCallsWidgetChannelLinkClick');

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerName());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().sendToRenderer(BROWSER_HISTORY_PUSH, this.callsWidgetWindow.getChannelURL());
        }
    }

    handleCallsError = (_: string, msg: CallsErrorMessage) => {
        log.debug('handleCallsError', msg);

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerName());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().sendToRenderer(CALLS_ERROR, msg);
        }
    }

    handleCallsLinkClick = (_: string, msg: CallsLinkClickMessage) => {
        log.debug('handleCallsLinkClick with linkURL', msg.link);

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerName());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().sendToRenderer(BROWSER_HISTORY_PUSH, msg.link);
        }
    }

    handleCallsLeave = () => {
        log.debug('handleCallsLeave');

        this.callsWidgetWindow?.close();
    }

    handleGetDesktopSources = async (viewName: string, opts: Electron.SourcesOptions) => {
        log.debug('handleGetDesktopSources', {viewName, opts});

        const view = ViewManager.getView(viewName);
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
                this.callsWidgetWindow?.win.webContents.send(CALLS_ERROR, screenPermissionsErrMsg);
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
            this.callsWidgetWindow?.win.webContents.send(CALLS_ERROR, screenPermissionsErrMsg);
        });
    }

    showMainWindow = (deeplinkingURL?: string | URL) => {
        log.debug('showMainWindow', deeplinkingURL);

        const mainWindow = MainWindow.get();
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.focus();
            } else {
                mainWindow.show();
            }
        } else {
            this.createMainWindow();
        }

        if (deeplinkingURL) {
            ViewManager.handleDeepLink(deeplinkingURL);
        }
    }

    private createMainWindow = () => {
        const mainWindow = MainWindow.get(true);
        if (!mainWindow) {
            return;
        }

        // window handlers
        mainWindow.on('maximize', this.handleMaximizeMainWindow);
        mainWindow.on('unmaximize', this.handleUnmaximizeMainWindow);
        if (process.platform !== 'darwin') {
            mainWindow.on('resize', this.handleResizeMainWindow);
        }
        mainWindow.on('will-resize', this.handleWillResizeMainWindow);
        mainWindow.on('resized', this.handleResizedMainWindow);
        mainWindow.on('focus', ViewManager.focusCurrentView);
        mainWindow.on('enter-full-screen', () => this.sendToRenderer('enter-full-screen'));
        mainWindow.on('leave-full-screen', () => this.sendToRenderer('leave-full-screen'));

        this.teamDropdown = new TeamDropdownView();
        this.downloadsDropdown = new DownloadsDropdownView();
        this.downloadsDropdownMenu = new DownloadsDropdownMenuView();

        this.initializeViewManager();
    }

    // max retries allows the message to get to the renderer even if it is sent while the app is starting up.
    private sendToRendererWithRetry = (maxRetries: number, channel: string, ...args: unknown[]) => {
        const mainWindow = MainWindow.get();

        if (!mainWindow || !MainWindow.isReady) {
            if (maxRetries > 0) {
                log.debug(`Can't send ${channel}, will retry`);
                setTimeout(() => {
                    this.sendToRendererWithRetry(maxRetries - 1, channel, ...args);
                }, SECOND);
            } else {
                log.error(`Unable to send the message to the main window for message type ${channel}`);
            }
            return;
        }
        mainWindow.webContents.send(channel, ...args);
        const settingsWindow = SettingsWindow.get();
        if (settingsWindow && settingsWindow.isVisible()) {
            try {
                settingsWindow.webContents.send(channel, ...args);
            } catch (e) {
                log.error(`There was an error while trying to communicate with the renderer: ${e}`);
            }
        }
    }

    sendToRenderer = (channel: string, ...args: unknown[]) => {
        this.sendToRendererWithRetry(3, channel, ...args);
    }

    restoreMain = () => {
        log.info('restoreMain');
        if (!MainWindow.get()) {
            this.showMainWindow();
        }
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            throw new Error('Main window does not exist');
        }
        if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            } else {
                mainWindow.show();
            }
            const settingsWindow = SettingsWindow.get();
            if (settingsWindow) {
                settingsWindow.focus();
            } else {
                mainWindow.focus();
            }
        } else if (SettingsWindow.get()) {
            SettingsWindow.get()!.focus();
        } else {
            mainWindow.focus();
        }
    }

    private initializeViewManager = () => {
        ViewManager.init();
    }

    switchServer = (serverId: string, waitForViewToExist = false) => {
        ServerManager.getServerLog(serverId, 'WindowManager').debug('switchServer');
        this.showMainWindow();
        const server = ServerManager.getServer(serverId);
        if (!server) {
            ServerManager.getServerLog(serverId, 'WindowManager').error('Cannot find server in config');
            return;
        }
        const nextTab = ServerManager.getLastActiveTabForServer(serverId);
        if (waitForViewToExist) {
            const timeout = setInterval(() => {
                if (ViewManager.getView(nextTab.id)) {
                    ViewManager.showById(nextTab.id);
                    clearTimeout(timeout);
                }
            }, 100);
        } else {
            ViewManager.showById(nextTab.id);
        }
        ipcMain.emit(UPDATE_SHORTCUT_MENU);
    }

    switchTab = (tabId: string) => {
        ViewManager.showById(tabId);
    }

    /**
     * ID fetching
     */

    getServerURLFromWebContentsId = (id: number) => {
        if (this.callsWidgetWindow && (id === this.callsWidgetWindow.getWebContentsId() || id === this.callsWidgetWindow.getPopOutWebContentsId())) {
            return this.callsWidgetWindow.getURL();
        }

        return ViewManager.getViewByWebContentsId(id)?.tab.server.url;
    }

    /**
     * Tab switching
     */

    selectNextTab = () => {
        this.selectTab((order) => order + 1);
    }

    selectPreviousTab = () => {
        this.selectTab((order, length) => (length + (order - 1)));
    }

    private selectTab = (fn: (order: number, length: number) => number) => {
        const currentView = ViewManager.getCurrentView();
        if (!currentView) {
            return;
        }

        const currentTeamTabs = ServerManager.getOrderedTabsForServer(currentView.tab.server.id).map((tab, index) => ({tab, index}));
        const filteredTabs = currentTeamTabs?.filter((tab) => tab.tab.isOpen);
        const currentTab = currentTeamTabs?.find((tab) => tab.tab.type === currentView.tab.type);
        if (!currentTeamTabs || !currentTab || !filteredTabs) {
            return;
        }

        let currentOrder = currentTab.index;
        let nextIndex = -1;
        while (nextIndex === -1) {
            const nextOrder = (fn(currentOrder, currentTeamTabs.length) % currentTeamTabs.length);
            nextIndex = filteredTabs.findIndex((tab) => tab.index === nextOrder);
            currentOrder = nextOrder;
        }

        const newTab = filteredTabs[nextIndex].tab;
        this.switchTab(newTab.id);
    }

    /*****************
     * MAIN WINDOW EVENT HANDLERS
     *****************/

    private handleMaximizeMainWindow = () => {
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        this.sendToRenderer(MAXIMIZE_CHANGE, true);
    }

    private handleUnmaximizeMainWindow = () => {
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        this.sendToRenderer(MAXIMIZE_CHANGE, false);
    }

    private handleWillResizeMainWindow = (event: Event, newBounds: Electron.Rectangle) => {
        log.silly('handleWillResizeMainWindow');

        if (!MainWindow.get()) {
            return;
        }

        /**
         * Fixes an issue on win11 related to Snap where the first "will-resize" event would return the same bounds
         * causing the "resize" event to not fire
         */
        const prevBounds = this.getBounds();
        if (prevBounds.height === newBounds.height && prevBounds.width === newBounds.width) {
            return;
        }

        if (this.isResizing && LoadingScreen.isHidden() && ViewManager.getCurrentView()) {
            log.debug('prevented resize');
            event.preventDefault();
            return;
        }

        this.throttledWillResize(newBounds);
        LoadingScreen.setBounds();
        this.teamDropdown?.updateWindowBounds();
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        ipcMain.emit(RESIZE_MODAL, null, newBounds);
    }

    private handleResizedMainWindow = () => {
        log.silly('handleResizedMainWindow');

        const bounds = this.getBounds();
        this.throttledWillResize(bounds);
        ipcMain.emit(RESIZE_MODAL, null, bounds);
        this.teamDropdown?.updateWindowBounds();
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        this.isResizing = false;
    }

    private throttledWillResize = (newBounds: Electron.Rectangle) => {
        log.silly('throttledWillResize', {newBounds});

        this.isResizing = true;
        this.setCurrentViewBounds(newBounds);
    }

    private handleResizeMainWindow = () => {
        log.silly('handleResizeMainWindow');

        if (!MainWindow.get()) {
            return;
        }
        if (this.isResizing) {
            return;
        }

        const bounds = this.getBounds();

        // Another workaround since the window doesn't update properly under Linux for some reason
        // See above comment
        setTimeout(this.setCurrentViewBounds, 10, bounds);

        LoadingScreen.setBounds();
        this.teamDropdown?.updateWindowBounds();
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        ipcMain.emit(RESIZE_MODAL, null, bounds);
    };

    private setCurrentViewBounds = (bounds: {width: number; height: number}) => {
        log.debug('setCurrentViewBounds', {bounds});

        const currentView = ViewManager.getCurrentView();
        if (currentView) {
            const adjustedBounds = getAdjustedWindowBoundaries(bounds.width, bounds.height, shouldHaveBackBar(currentView.tab.url, currentView.currentURL));
            this.setBoundsFunction(currentView, adjustedBounds);
        }
    }

    private setBoundsFunction = (currentView: MattermostView, bounds: Electron.Rectangle) => {
        log.silly('setBoundsFunction', bounds.width, bounds.height);
        currentView.setBounds(bounds);
    };

    private getBounds = () => {
        let bounds;

        const mainWindow = MainWindow.get();
        if (mainWindow) {
            // Workaround for linux maximizing/minimizing, which doesn't work properly because of these bugs:
            // https://github.com/electron/electron/issues/28699
            // https://github.com/electron/electron/issues/28106
            if (process.platform === 'linux') {
                const size = mainWindow.getSize();
                bounds = {width: size[0], height: size[1]};
            } else {
                bounds = mainWindow.getContentBounds();
            }
        }

        return bounds as Electron.Rectangle;
    }

    /*****************
     * IPC EVENT HANDLERS
     *****************/

    private handleGetDarkMode = () => {
        return Config.darkMode;
    }

    private handleViewFinishedResizing = () => {
        this.isResizing = false;
    }

    private handleClose = () => {
        const focused = BrowserWindow.getFocusedWindow();
        focused?.close();
    }
    private handleMaximize = () => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) {
            focused.maximize();
        }
    }
    private handleMinimize = () => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) {
            focused.minimize();
        }
    }
    private handleRestore = () => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) {
            focused.restore();
        }
        if (focused?.isFullScreen()) {
            focused.setFullScreen(false);
        }
    }

    handleDoubleClick = (e: IpcMainEvent, windowType?: string) => {
        log.debug('handleDoubleClick', windowType);

        let action = 'Maximize';
        if (process.platform === 'darwin') {
            action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
        }
        const win = (windowType === 'settings') ? SettingsWindow.get() : MainWindow.get();
        if (!win) {
            return;
        }
        switch (action) {
        case 'Minimize':
            if (win.isMinimized()) {
                win.restore();
            } else {
                win.minimize();
            }
            break;
        case 'Maximize':
        default:
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
            break;
        }
    }

    /**
     * Server Manager update handler
     */
    private handleUpdateConfig = () => {
        MainWindow.get()?.webContents.send(SERVERS_UPDATE);
    }
}

const windowManager = new WindowManager();
export default windowManager;
