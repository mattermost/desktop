// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import {app, BrowserWindow, systemPreferences, ipcMain, IpcMainEvent, IpcMainInvokeEvent, desktopCapturer} from 'electron';
import log from 'electron-log';

import {
    CallsJoinCallMessage,
    CallsErrorMessage,
    CallsLinkClickMessage,
    CallsEventHandler,
} from 'types/calls';

import {
    MAXIMIZE_CHANGE,
    HISTORY,
    REACT_APP_INITIALIZED,
    LOADING_SCREEN_ANIMATION_FINISHED,
    GET_DARK_MODE,
    UPDATE_SHORTCUT_MENU,
    BROWSER_HISTORY_PUSH,
    APP_LOGGED_IN,
    GET_VIEW_ID,
    GET_VIEW_WEBCONTENTS_ID,
    RESIZE_MODAL,
    APP_LOGGED_OUT,
    BROWSER_HISTORY_BUTTON,
    DISPATCH_GET_DESKTOP_SOURCES,
    DESKTOP_SOURCES_RESULT,
    RELOAD_CURRENT_VIEW,
    VIEW_FINISHED_RESIZING,
    CALLS_JOIN_CALL,
    CALLS_LEAVE_CALL,
    DESKTOP_SOURCES_MODAL_REQUEST,
    CALLS_WIDGET_CHANNEL_LINK_CLICK,
    CALLS_ERROR,
    CALLS_LINK_CLICK,
    SERVERS_UPDATE,
    WINDOW_CLOSE,
    WINDOW_MAXIMIZE,
    WINDOW_MINIMIZE,
    WINDOW_RESTORE,
    DOUBLE_CLICK_ON_WINDOW,
} from 'common/communication';
import urlUtils from 'common/utils/url';
import {SECOND} from 'common/utils/constants';
import Config from 'common/config';
import {TAB_MESSAGING} from 'common/tabs/TabView';
import ServerManager from 'common/servers/serverManager';

import {
    getAdjustedWindowBoundaries,
    shouldHaveBackBar,
    resetScreensharePermissionsMacOS,
    openScreensharePermissionsSettingsMacOS,
} from '../utils';

import ViewManager from '../views/viewManager';
import {MattermostView} from '../views/MattermostView';
import TeamDropdownView from '../views/teamDropdownView';
import DownloadsDropdownView from '../views/downloadsDropdownView';
import DownloadsDropdownMenuView from '../views/downloadsDropdownMenuView';

import MainWindow from './mainWindow';
import CallsWidgetWindow from './callsWidgetWindow';
import SettingsWindow from './settingsWindow';

// singleton module to manage application's windows

export class WindowManager {
    callsWidgetWindow?: CallsWidgetWindow;

    private teamDropdown?: TeamDropdownView;
    private downloadsDropdown?: DownloadsDropdownView;
    private downloadsDropdownMenu?: DownloadsDropdownMenuView;
    private missingScreensharePermissions?: boolean;

    private isResizing: boolean;

    constructor() {
        this.isResizing = false;

        ipcMain.on(HISTORY, this.handleHistory);
        ipcMain.handle(GET_DARK_MODE, this.handleGetDarkMode);
        ipcMain.on(REACT_APP_INITIALIZED, this.handleReactAppInitialized);
        ipcMain.on(LOADING_SCREEN_ANIMATION_FINISHED, this.handleLoadingScreenAnimationFinished);
        ipcMain.on(BROWSER_HISTORY_PUSH, this.handleBrowserHistoryPush);
        ipcMain.on(BROWSER_HISTORY_BUTTON, this.handleBrowserHistoryButton);
        ipcMain.on(APP_LOGGED_IN, this.handleAppLoggedIn);
        ipcMain.on(APP_LOGGED_OUT, this.handleAppLoggedOut);
        ipcMain.handle(GET_VIEW_ID, this.handleGetViewId);
        ipcMain.handle(GET_VIEW_WEBCONTENTS_ID, this.handleGetWebContentsId);
        ipcMain.on(RELOAD_CURRENT_VIEW, this.handleReloadCurrentView);
        ipcMain.on(VIEW_FINISHED_RESIZING, this.handleViewFinishedResizing);
        ipcMain.on(WINDOW_CLOSE, this.handleClose);
        ipcMain.on(WINDOW_MAXIMIZE, this.handleMaximize);
        ipcMain.on(WINDOW_MINIMIZE, this.handleMinimize);
        ipcMain.on(WINDOW_RESTORE, this.handleRestore);
        ipcMain.on(DOUBLE_CLICK_ON_WINDOW, this.handleDoubleClick);

        // Calls handlers
        ipcMain.on(DISPATCH_GET_DESKTOP_SOURCES, this.genCallsEventHandler(this.handleGetDesktopSources));
        ipcMain.on(DESKTOP_SOURCES_MODAL_REQUEST, this.genCallsEventHandler(this.handleDesktopSourcesModalRequest));
        ipcMain.on(CALLS_JOIN_CALL, this.genCallsEventHandler(this.createCallsWidgetWindow));
        ipcMain.on(CALLS_LEAVE_CALL, this.genCallsEventHandler(this.handleCallsLeave));
        ipcMain.on(CALLS_WIDGET_CHANNEL_LINK_CLICK, this.genCallsEventHandler(this.handleCallsWidgetChannelLinkClick));
        ipcMain.on(CALLS_ERROR, this.genCallsEventHandler(this.handleCallsError));
        ipcMain.on(CALLS_LINK_CLICK, this.genCallsEventHandler(this.handleCallsLinkClick));

        ServerManager.on(SERVERS_UPDATE, this.handleUpdateConfig);
    }

    showMainWindow = (deeplinkingURL?: string | URL) => {
        log.debug('WindowManager.showMainWindow', deeplinkingURL);

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
        mainWindow.on('focus', this.focusBrowserView);
        mainWindow.on('enter-full-screen', () => this.sendToRenderer('enter-full-screen'));
        mainWindow.on('leave-full-screen', () => this.sendToRenderer('leave-full-screen'));

        this.teamDropdown = new TeamDropdownView(mainWindow);
        this.downloadsDropdown = new DownloadsDropdownView(mainWindow);
        this.downloadsDropdownMenu = new DownloadsDropdownMenuView(mainWindow);

        this.initializeViewManager();
    }

    // max retries allows the message to get to the renderer even if it is sent while the app is starting up.
    private sendToRendererWithRetry = (maxRetries: number, channel: string, ...args: unknown[]) => {
        const mainWindow = MainWindow.get();

        if (!mainWindow || !MainWindow.isReady) {
            if (maxRetries > 0) {
                log.info(`Can't send ${channel}, will retry`);
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
        ViewManager.load();
        ViewManager.showInitial();
    }

    switchServer = (serverId: string, waitForViewToExist = false) => {
        log.debug('windowManager.switchServer');
        this.showMainWindow();
        const server = ServerManager.getServer(serverId);
        if (!server) {
            log.error('Cannot find server in config');
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

    focusBrowserView = () => {
        log.debug('WindowManager.focusBrowserView');

        if (ViewManager) {
            ViewManager.focus();
        } else {
            log.error('Trying to call focus when the viewManager has not yet been initialized');
        }
    }

    openBrowserViewDevTools = () => {
        if (ViewManager) {
            ViewManager.openViewDevTools();
        }
    }

    updateLoadingScreenDarkMode = (darkMode: boolean) => {
        if (ViewManager) {
            ViewManager.updateLoadingScreenDarkMode(darkMode);
        }
    }

    reload = () => {
        const currentView = ViewManager.getCurrentView();
        if (currentView) {
            ViewManager.showLoadingScreen();
            currentView.reload();
        }
    }

    sendToFind = () => {
        const currentView = ViewManager.getCurrentView();
        if (currentView) {
            currentView.view.webContents.sendInputEvent({type: 'keyDown', keyCode: 'F', modifiers: [process.platform === 'darwin' ? 'cmd' : 'ctrl', 'shift']});
        }
    }

    /**
     * ID fetching
     */

    getViewIdByWebContentsId = (webContentsId: number) => {
        const view = ViewManager.findViewByWebContent(webContentsId);
        return view?.id;
    }

    getServerNameByWebContentsId = (webContentsId: number) => {
        const view = ViewManager.findViewByWebContent(webContentsId);
        return view?.tab.server.name;
    }

    getServerURLFromWebContentsId = (id: number) => {
        if (this.callsWidgetWindow && (id === this.callsWidgetWindow.getWebContentsId() || id === this.callsWidgetWindow.getPopOutWebContentsId())) {
            return this.callsWidgetWindow.getURL();
        }

        const viewId = this.getViewIdByWebContentsId(id);
        if (!viewId) {
            return undefined;
        }
        return ViewManager.getView(viewId)?.tab.server.url;
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
        const currentTab = currentTeamTabs?.find((tab) => tab.tab.name === currentView.tab.type);
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
        log.silly('WindowManager.handleWillResizeMainWindow');

        /**
         * Fixes an issue on win11 related to Snap where the first "will-resize" event would return the same bounds
         * causing the "resize" event to not fire
         */
        const prevBounds = this.getBounds();
        if (prevBounds.height === newBounds.height && prevBounds.width === newBounds.width) {
            return;
        }

        if (this.isResizing && ViewManager.isLoadingScreenHidden() && ViewManager.getCurrentView()) {
            log.debug('prevented resize');
            event.preventDefault();
            return;
        }

        this.throttledWillResize(newBounds);
        ViewManager.setLoadingScreenBounds();
        this.teamDropdown?.updateWindowBounds();
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        ipcMain.emit(RESIZE_MODAL, null, newBounds);
    }

    private handleResizedMainWindow = () => {
        log.silly('WindowManager.handleResizedMainWindow');

        const bounds = this.getBounds();
        this.throttledWillResize(bounds);
        ipcMain.emit(RESIZE_MODAL, null, bounds);
        this.teamDropdown?.updateWindowBounds();
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        this.isResizing = false;
    }

    private throttledWillResize = (newBounds: Electron.Rectangle) => {
        log.silly('WindowManager.throttledWillResize', {newBounds});

        this.isResizing = true;
        this.setCurrentViewBounds(newBounds);
    }

    private handleResizeMainWindow = () => {
        log.silly('WindowManager.handleResizeMainWindow');

        if (this.isResizing) {
            return;
        }

        const bounds = this.getBounds();

        // Another workaround since the window doesn't update properly under Linux for some reason
        // See above comment
        setTimeout(this.setCurrentViewBounds, 10, bounds);
        ViewManager.setLoadingScreenBounds();
        this.teamDropdown?.updateWindowBounds();
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        ipcMain.emit(RESIZE_MODAL, null, bounds);
    };

    private setCurrentViewBounds = (bounds: {width: number; height: number}) => {
        log.debug('WindowManager.setCurrentViewBounds', {bounds});

        const currentView = ViewManager.getCurrentView();
        if (currentView) {
            const adjustedBounds = getAdjustedWindowBoundaries(bounds.width, bounds.height, shouldHaveBackBar(currentView.tab.url, currentView.view.webContents.getURL()));
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

    private handleReactAppInitialized = (e: IpcMainEvent, view: string) => {
        log.debug('WindowManager.handleReactAppInitialized', view);

        if (ViewManager) {
            ViewManager.setServerInitialized(view);
        }
    }

    private handleHistory = (event: IpcMainEvent, offset: number) => {
        log.debug('WindowManager.handleHistory', offset);

        if (ViewManager) {
            const activeView = ViewManager.getCurrentView();
            if (activeView && activeView.view.webContents.canGoToOffset(offset)) {
                try {
                    activeView.view.webContents.goToOffset(offset);
                } catch (error) {
                    log.error(error);
                    activeView.load(activeView.tab.url);
                }
            }
        }
    }

    private handleGetDarkMode = () => {
        return Config.darkMode;
    }

    private handleLoadingScreenAnimationFinished = () => {
        log.debug('WindowManager.handleLoadingScreenAnimationFinished');

        if (ViewManager) {
            ViewManager.hideLoadingScreen();
        }

        if (process.env.NODE_ENV === 'test') {
            app.emit('e2e-app-loaded');
        }
    }

    private handleBrowserHistoryPush = (e: IpcMainEvent, viewId: string, pathName: string) => {
        log.debug('WindowManager.handleBrowserHistoryPush', {viewId, pathName});

        const currentView = ViewManager.getView(viewId);
        const cleanedPathName = urlUtils.cleanPathName(currentView?.tab.server.url.pathname || '', pathName);
        const redirectedviewId = ServerManager.lookupTabByURL(`${currentView?.tab.server.url.toString().replace(/\/$/, '')}${cleanedPathName}`)?.id || viewId;
        if (ViewManager.isViewClosed(redirectedviewId)) {
            // If it's a closed view, just open it and stop
            ViewManager.openClosedTab(redirectedviewId, `${currentView?.tab.server.url}${cleanedPathName}`);
            return;
        }
        let redirectedView = ViewManager.getView(redirectedviewId) || currentView;
        if (redirectedView !== currentView && redirectedView?.tab.server.id === ServerManager.getCurrentServer().id && redirectedView?.isLoggedIn) {
            log.info('redirecting to a new view', redirectedView?.id || viewId);
            ViewManager.showById(redirectedView?.id || viewId);
        } else {
            redirectedView = currentView;
        }

        // Special case check for Channels to not force a redirect to "/", causing a refresh
        if (!(redirectedView !== currentView && redirectedView?.tab.type === TAB_MESSAGING && cleanedPathName === '/')) {
            redirectedView?.view.webContents.send(BROWSER_HISTORY_PUSH, cleanedPathName);
            if (redirectedView) {
                this.handleBrowserHistoryButton(e, redirectedView.id);
            }
        }
    }

    private handleBrowserHistoryButton = (e: IpcMainEvent, viewId: string) => {
        log.debug('WindowManager.handleBrowserHistoryButton', viewId);

        const currentView = ViewManager.getView(viewId);
        if (currentView) {
            if (currentView.view.webContents.getURL() === currentView.tab.url.toString()) {
                currentView.view.webContents.clearHistory();
                currentView.isAtRoot = true;
            } else {
                currentView.isAtRoot = false;
            }
            currentView?.view.webContents.send(BROWSER_HISTORY_BUTTON, currentView.view.webContents.canGoBack(), currentView.view.webContents.canGoForward());
        }
    }

    private handleAppLoggedIn = (event: IpcMainEvent, viewId: string) => {
        log.debug('WindowManager.handleAppLoggedIn', viewId);

        const view = ViewManager.getView(viewId);
        if (view && !view.isLoggedIn) {
            view.isLoggedIn = true;
            ViewManager.reloadViewIfNeeded(viewId);
        }
    }

    private handleAppLoggedOut = (event: IpcMainEvent, viewId: string) => {
        log.debug('WindowManager.handleAppLoggedOut', viewId);

        const view = ViewManager.getView(viewId);
        if (view && view.isLoggedIn) {
            view.isLoggedIn = false;
        }
    }

    private handleGetViewId = (event: IpcMainInvokeEvent) => {
        // TODO
        const viewId = this.getViewIdByWebContentsId(event.sender.id);
        if (!viewId) {
            return null;
        }
        const view = ViewManager.getView(viewId);
        if (!view) {
            return null;
        }
        return `${view.tab.server.name}___${view.tab.name}`;
    }

    private handleGetWebContentsId = (event: IpcMainInvokeEvent) => {
        return event.sender.id;
    }

    private handleReloadCurrentView = () => {
        log.debug('WindowManager.handleReloadCurrentView');

        const view = ViewManager.getCurrentView();
        if (!view) {
            return;
        }
        view?.reload();
        ViewManager.showById(view?.id);
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
        log.debug('WindowManager.handleDoubleClick', windowType);

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

    /************************
     * CALLS WIDGET HANDLERS
     ************************/

    private genCallsEventHandler = (handler: CallsEventHandler) => {
        return (event: IpcMainEvent, viewId: string, msg?: any) => {
            if (this.callsWidgetWindow && !this.callsWidgetWindow.isAllowedEvent(event)) {
                log.warn('WindowManager.genCallsEventHandler', 'Disallowed calls event');
                return;
            }
            handler(viewId, msg);
        };
    }

    private handleGetDesktopSources = async (viewId: string, opts: Electron.SourcesOptions) => {
        log.debug('WindowManager.handleGetDesktopSources', {viewId, opts});

        const view = ViewManager.getView(viewId);
        if (!view) {
            log.error('WindowManager.handleGetDesktopSources: view not found');
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
                view.view.webContents.send(CALLS_ERROR, screenPermissionsErrMsg);
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
                view.view.webContents.send(DESKTOP_SOURCES_RESULT, message);
            }
        }).catch((err) => {
            log.error('desktopCapturer.getSources failed', err);

            view.view.webContents.send(CALLS_ERROR, screenPermissionsErrMsg);
            this.callsWidgetWindow?.win.webContents.send(CALLS_ERROR, screenPermissionsErrMsg);
        });
    }

    private createCallsWidgetWindow = async (viewId: string, msg: CallsJoinCallMessage) => {
        log.debug('WindowManager.createCallsWidgetWindow');
        if (this.callsWidgetWindow) {
            // trying to join again the call we are already in should not be allowed.
            if (this.callsWidgetWindow.getCallID() === msg.callID) {
                return;
            }

            // to switch from one call to another we need to wait for the existing
            // window to be fully closed.
            await this.callsWidgetWindow.close();
        }
        const currentView = ViewManager.getView(viewId);
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

    private handleDesktopSourcesModalRequest = () => {
        log.debug('WindowManager.handleDesktopSourcesModalRequest');

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerId());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().view.webContents.send(DESKTOP_SOURCES_MODAL_REQUEST);
        }
    }

    private handleCallsLeave = () => {
        log.debug('WindowManager.handleCallsLeave');

        this.callsWidgetWindow?.close();
    }

    private handleCallsWidgetChannelLinkClick = () => {
        log.debug('WindowManager.handleCallsWidgetChannelLinkClick');

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerId());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().view.webContents.send(BROWSER_HISTORY_PUSH, this.callsWidgetWindow.getChannelURL());
        }
    }

    private handleCallsError = (_: string, msg: CallsErrorMessage) => {
        log.debug('WindowManager.handleCallsError', msg);

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerId());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().view.webContents.send(CALLS_ERROR, msg);
        }
    }

    private handleCallsLinkClick = (_: string, msg: CallsLinkClickMessage) => {
        log.debug('WindowManager.handleCallsLinkClick with linkURL', msg.link);

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerId());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().view.webContents.send(BROWSER_HISTORY_PUSH, msg.link);
        }
    }

    /**
     * Server Manager update handler
     */
    private handleUpdateConfig = () => {
        if (ViewManager) {
            ViewManager.reloadConfiguration();
        }
        MainWindow.get()?.webContents.send(SERVERS_UPDATE);
    }
}

const windowManager = new WindowManager();
export default windowManager;
