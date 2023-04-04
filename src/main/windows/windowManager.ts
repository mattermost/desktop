// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
import path from 'path';

import {app, BrowserWindow, systemPreferences, ipcMain, IpcMainEvent, IpcMainInvokeEvent, desktopCapturer} from 'electron';

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
    FOCUS_THREE_DOT_MENU,
    GET_DARK_MODE,
    UPDATE_SHORTCUT_MENU,
    BROWSER_HISTORY_PUSH,
    APP_LOGGED_IN,
    GET_VIEW_NAME,
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
} from 'common/communication';
import logger from 'common/log';
import urlUtils from 'common/utils/url';
import {SECOND} from 'common/utils/constants';
import Config from 'common/config';
import {getTabViewName, TAB_MESSAGING} from 'common/tabs/TabView';

import downloadsManager from 'main/downloadsManager';
import {MattermostView} from 'main/views/MattermostView';

import {
    getAdjustedWindowBoundaries,
    shouldHaveBackBar,
    resetScreensharePermissionsMacOS,
    openScreensharePermissionsSettingsMacOS,
} from '../utils';

import {ViewManager} from '../views/viewManager';
import LoadingScreen from '../views/loadingScreen';
import TeamDropdownView from '../views/teamDropdownView';
import DownloadsDropdownView from '../views/downloadsDropdownView';
import DownloadsDropdownMenuView from '../views/downloadsDropdownMenuView';

import MainWindow from './mainWindow';
import CallsWidgetWindow from './callsWidgetWindow';
import SettingsWindow from './settingsWindow';

// singleton module to manage application's windows

const log = logger.withPrefix('WindowManager');

export class WindowManager {
    assetsDir: string;

    callsWidgetWindow?: CallsWidgetWindow;
    viewManager?: ViewManager;
    teamDropdown?: TeamDropdownView;
    downloadsDropdown?: DownloadsDropdownView;
    downloadsDropdownMenu?: DownloadsDropdownMenuView;
    currentServerName?: string;
    missingScreensharePermissions?: boolean;

    constructor() {
        this.assetsDir = path.resolve(app.getAppPath(), 'assets');

        ipcMain.on(HISTORY, this.handleHistory);
        ipcMain.handle(GET_DARK_MODE, this.handleGetDarkMode);
        ipcMain.on(REACT_APP_INITIALIZED, this.handleReactAppInitialized);
        ipcMain.on(BROWSER_HISTORY_PUSH, this.handleBrowserHistoryPush);
        ipcMain.on(BROWSER_HISTORY_BUTTON, this.handleBrowserHistoryButton);
        ipcMain.on(APP_LOGGED_IN, this.handleAppLoggedIn);
        ipcMain.on(APP_LOGGED_OUT, this.handleAppLoggedOut);
        ipcMain.handle(GET_VIEW_NAME, this.handleGetViewName);
        ipcMain.handle(GET_VIEW_WEBCONTENTS_ID, this.handleGetWebContentsId);
        ipcMain.on(RELOAD_CURRENT_VIEW, this.handleReloadCurrentView);
        ipcMain.on(VIEW_FINISHED_RESIZING, this.handleViewFinishedResizing);

        // Calls handlers
        ipcMain.on(DISPATCH_GET_DESKTOP_SOURCES, this.genCallsEventHandler(this.handleGetDesktopSources));
        ipcMain.on(DESKTOP_SOURCES_MODAL_REQUEST, this.genCallsEventHandler(this.handleDesktopSourcesModalRequest));
        ipcMain.on(CALLS_JOIN_CALL, this.genCallsEventHandler(this.createCallsWidgetWindow));
        ipcMain.on(CALLS_LEAVE_CALL, this.genCallsEventHandler(this.handleCallsLeave));
        ipcMain.on(CALLS_WIDGET_CHANNEL_LINK_CLICK, this.genCallsEventHandler(this.handleCallsWidgetChannelLinkClick));
        ipcMain.on(CALLS_ERROR, this.genCallsEventHandler(this.handleCallsError));
        ipcMain.on(CALLS_LINK_CLICK, this.genCallsEventHandler(this.handleCallsLinkClick));
    }

    handleUpdateConfig = () => {
        if (this.viewManager) {
            this.viewManager.reloadConfiguration(Config.teams || []);
        }
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
        const currentView = this.viewManager?.views.get(viewName);
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
            this.callsWidgetWindow.getMainView().view.webContents.send(DESKTOP_SOURCES_MODAL_REQUEST);
        }
    }

    handleCallsWidgetChannelLinkClick = () => {
        log.debug('handleCallsWidgetChannelLinkClick');

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerName());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().view.webContents.send(BROWSER_HISTORY_PUSH, this.callsWidgetWindow.getChannelURL());
        }
    }

    handleCallsError = (_: string, msg: CallsErrorMessage) => {
        log.debug('handleCallsError', msg);

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerName());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().view.webContents.send(CALLS_ERROR, msg);
        }
    }

    handleCallsLinkClick = (_: string, msg: CallsLinkClickMessage) => {
        log.debug('handleCallsLinkClick with linkURL', msg.link);

        if (this.callsWidgetWindow) {
            this.switchServer(this.callsWidgetWindow.getServerName());
            MainWindow.get()?.focus();
            this.callsWidgetWindow.getMainView().view.webContents.send(BROWSER_HISTORY_PUSH, msg.link);
        }
    }

    handleCallsLeave = () => {
        log.debug('handleCallsLeave');

        this.callsWidgetWindow?.close();
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
            this.viewManager?.handleDeepLink(deeplinkingURL);
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

        this.teamDropdown = new TeamDropdownView(Config.teams, Config.darkMode, Config.enableServerManagement);
        this.downloadsDropdown = new DownloadsDropdownView(downloadsManager.getDownloads(), Config.darkMode);
        this.downloadsDropdownMenu = new DownloadsDropdownMenuView(Config.darkMode);

        this.initializeViewManager();
    }

    handleMaximizeMainWindow = () => {
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        this.sendToRenderer(MAXIMIZE_CHANGE, true);
    }

    handleUnmaximizeMainWindow = () => {
        this.downloadsDropdown?.updateWindowBounds();
        this.downloadsDropdownMenu?.updateWindowBounds();
        this.sendToRenderer(MAXIMIZE_CHANGE, false);
    }

    isResizing = false;

    handleWillResizeMainWindow = (event: Event, newBounds: Electron.Rectangle) => {
        log.silly('handleWillResizeMainWindow');

        if (!(this.viewManager && MainWindow.get())) {
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

        if (this.isResizing && LoadingScreen.isHidden() && this.viewManager.getCurrentView()) {
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

    handleResizedMainWindow = () => {
        log.silly('handleResizedMainWindow');

        if (MainWindow.get()) {
            const bounds = this.getBounds();
            this.throttledWillResize(bounds);
            ipcMain.emit(RESIZE_MODAL, null, bounds);
            this.teamDropdown?.updateWindowBounds();
            this.downloadsDropdown?.updateWindowBounds();
            this.downloadsDropdownMenu?.updateWindowBounds();
        }
        this.isResizing = false;
    }

    handleViewFinishedResizing = () => {
        this.isResizing = false;
    }

    private throttledWillResize = (newBounds: Electron.Rectangle) => {
        log.silly('throttledWillResize', {newBounds});

        this.isResizing = true;
        this.setCurrentViewBounds(newBounds);
    }

    handleResizeMainWindow = () => {
        log.silly('handleResizeMainWindow');

        if (!(this.viewManager && MainWindow.get())) {
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

    setCurrentViewBounds = (bounds: {width: number; height: number}) => {
        log.debug('setCurrentViewBounds', {bounds});

        const currentView = this.viewManager?.getCurrentView();
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

    // max retries allows the message to get to the renderer even if it is sent while the app is starting up.
    sendToRendererWithRetry = (maxRetries: number, channel: string, ...args: unknown[]) => {
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
        SettingsWindow.get()?.webContents.send(channel, ...args);
    }

    sendToRenderer = (channel: string, ...args: unknown[]) => {
        this.sendToRendererWithRetry(3, channel, ...args);
    }

    sendToAll = (channel: string, ...args: unknown[]) => {
        this.sendToRenderer(channel, ...args);
        SettingsWindow.get()?.webContents.send(channel, ...args);

        // TODO: should we include popups?
    }

    sendToMattermostViews = (channel: string, ...args: unknown[]) => {
        if (this.viewManager) {
            this.viewManager.sendToAllViews(channel, ...args);
        }
    }

    restoreMain = () => {
        log.info('restoreMain');

        const mainWindow = MainWindow.get(true);
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
            SettingsWindow.get()?.focus();
        } else {
            mainWindow.focus();
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

    initializeViewManager = () => {
        if (!this.viewManager && Config) {
            this.viewManager = new ViewManager();
            this.viewManager.load();
            this.viewManager.showInitial();
            this.initializeCurrentServerName();
        }
    }

    initializeCurrentServerName = () => {
        if (!this.currentServerName) {
            this.currentServerName = (Config.teams.find((team) => team.order === Config.lastActiveTeam) || Config.teams.find((team) => team.order === 0))?.name;
        }
    }

    switchServer = (serverName: string, waitForViewToExist = false) => {
        log.debug('switchServer');
        this.showMainWindow();
        const server = Config.teams.find((team) => team.name === serverName);
        if (!server) {
            log.error('Cannot find server in config');
            return;
        }
        this.currentServerName = serverName;
        let nextTab = server.tabs.find((tab) => tab.isOpen && tab.order === (server.lastActiveTab || 0));
        if (!nextTab) {
            const openTabs = server.tabs.filter((tab) => tab.isOpen);
            nextTab = openTabs.find((e) => e.order === 0) || openTabs.concat().sort((a, b) => a.order - b.order)[0];
        }
        const tabViewName = getTabViewName(serverName, nextTab.name);
        if (waitForViewToExist) {
            const timeout = setInterval(() => {
                if (this.viewManager?.views.has(tabViewName)) {
                    this.viewManager?.showByName(tabViewName);
                    clearTimeout(timeout);
                }
            }, 100);
        } else {
            this.viewManager?.showByName(tabViewName);
        }
        ipcMain.emit(UPDATE_SHORTCUT_MENU);
    }

    switchTab = (serverName: string, tabName: string) => {
        log.debug('switchTab');
        this.showMainWindow();
        const tabViewName = getTabViewName(serverName, tabName);
        this.viewManager?.showByName(tabViewName);
    }

    focusBrowserView = () => {
        log.debug('focusBrowserView');

        if (this.viewManager) {
            this.viewManager.focus();
        } else {
            log.error('Trying to call focus when the viewManager has not yet been initialized');
        }
    }

    openBrowserViewDevTools = () => {
        if (this.viewManager) {
            this.viewManager.openViewDevTools();
        }
    }

    focusThreeDotMenu = () => {
        MainWindow.get()?.webContents.focus();
        MainWindow.get()?.webContents.send(FOCUS_THREE_DOT_MENU);
    }

    handleLoadingScreenDataRequest = () => {
        return {
            darkMode: Config.darkMode || false,
        };
    }

    handleReactAppInitialized = (e: IpcMainEvent, view: string) => {
        log.debug('handleReactAppInitialized', view);

        if (this.viewManager) {
            this.viewManager.setServerInitialized(view);
        }
    }

    getViewNameByWebContentsId = (webContentsId: number) => {
        const view = this.viewManager?.findViewByWebContent(webContentsId);
        return view?.name;
    }

    getServerNameByWebContentsId = (webContentsId: number) => {
        const view = this.viewManager?.findViewByWebContent(webContentsId);
        return view?.tab.server.name;
    }

    close = () => {
        const focused = BrowserWindow.getFocusedWindow();
        focused?.close();
    }
    maximize = () => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) {
            focused.maximize();
        }
    }
    minimize = () => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) {
            focused.minimize();
        }
    }
    restore = () => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) {
            focused.restore();
        }
        if (focused?.isFullScreen()) {
            focused.setFullScreen(false);
        }
    }

    reload = () => {
        const currentView = this.viewManager?.getCurrentView();
        if (currentView) {
            LoadingScreen.show();
            currentView.reload();
        }
    }

    sendToFind = () => {
        const currentView = this.viewManager?.getCurrentView();
        if (currentView) {
            currentView.view.webContents.sendInputEvent({type: 'keyDown', keyCode: 'F', modifiers: [process.platform === 'darwin' ? 'cmd' : 'ctrl', 'shift']});
        }
    }

    handleHistory = (event: IpcMainEvent, offset: number) => {
        log.debug('handleHistory', offset);

        if (this.viewManager) {
            const activeView = this.viewManager.getCurrentView();
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

    selectNextTab = () => {
        this.selectTab((order) => order + 1);
    }

    selectPreviousTab = () => {
        this.selectTab((order, length) => (length + (order - 1)));
    }

    selectTab = (fn: (order: number, length: number) => number) => {
        const currentView = this.viewManager?.getCurrentView();
        if (!currentView) {
            return;
        }

        const currentTeamTabs = Config.teams.find((team) => team.name === currentView.tab.server.name)?.tabs;
        const filteredTabs = currentTeamTabs?.filter((tab) => tab.isOpen);
        const currentTab = currentTeamTabs?.find((tab) => tab.name === currentView.tab.type);
        if (!currentTeamTabs || !currentTab || !filteredTabs) {
            return;
        }

        let currentOrder = currentTab.order;
        let nextIndex = -1;
        while (nextIndex === -1) {
            const nextOrder = (fn(currentOrder, currentTeamTabs.length) % currentTeamTabs.length);
            nextIndex = filteredTabs.findIndex((tab) => tab.order === nextOrder);
            currentOrder = nextOrder;
        }

        const newTab = filteredTabs[nextIndex];
        this.switchTab(currentView.tab.server.name, newTab.name);
    }

    handleGetDarkMode = () => {
        return Config.darkMode;
    }

    handleBrowserHistoryPush = (e: IpcMainEvent, viewName: string, pathName: string) => {
        log.debug('handleBrowserHistoryPush', {viewName, pathName});

        const currentView = this.viewManager?.views.get(viewName);
        const cleanedPathName = urlUtils.cleanPathName(currentView?.tab.server.url.pathname || '', pathName);
        const redirectedViewName = this.viewManager?.getViewByURL(`${currentView?.tab.server.url.toString().replace(/\/$/, '')}${cleanedPathName}`)?.name || viewName;
        if (this.viewManager?.closedViews.has(redirectedViewName)) {
            // If it's a closed view, just open it and stop
            this.viewManager.openClosedTab(redirectedViewName, `${currentView?.tab.server.url}${cleanedPathName}`);
            return;
        }
        let redirectedView = this.viewManager?.views.get(redirectedViewName) || currentView;
        if (redirectedView !== currentView && redirectedView?.tab.server.name === this.currentServerName && redirectedView?.isLoggedIn) {
            log.info('redirecting to a new view', redirectedView?.name || viewName);
            this.viewManager?.showByName(redirectedView?.name || viewName);
        } else {
            redirectedView = currentView;
        }

        // Special case check for Channels to not force a redirect to "/", causing a refresh
        if (!(redirectedView !== currentView && redirectedView?.tab.type === TAB_MESSAGING && cleanedPathName === '/')) {
            redirectedView?.view.webContents.send(BROWSER_HISTORY_PUSH, cleanedPathName);
            if (redirectedView) {
                this.handleBrowserHistoryButton(e, redirectedView.name);
            }
        }
    }

    handleBrowserHistoryButton = (e: IpcMainEvent, viewName: string) => {
        log.debug('handleBrowserHistoryButton', viewName);

        const currentView = this.viewManager?.views.get(viewName);
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

    getCurrentTeamName = () => {
        return this.currentServerName;
    }

    handleAppLoggedIn = (event: IpcMainEvent, viewName: string) => {
        log.debug('handleAppLoggedIn', viewName);

        const view = this.viewManager?.views.get(viewName);
        if (view && !view.isLoggedIn) {
            view.isLoggedIn = true;
            this.viewManager?.reloadViewIfNeeded(viewName);
        }
    }

    handleAppLoggedOut = (event: IpcMainEvent, viewName: string) => {
        log.debug('handleAppLoggedOut', viewName);

        const view = this.viewManager?.views.get(viewName);
        if (view && view.isLoggedIn) {
            view.isLoggedIn = false;
        }
    }

    handleGetViewName = (event: IpcMainInvokeEvent) => {
        return this.getViewNameByWebContentsId(event.sender.id);
    }

    handleGetWebContentsId = (event: IpcMainInvokeEvent) => {
        return event.sender.id;
    }

    handleGetDesktopSources = async (viewName: string, opts: Electron.SourcesOptions) => {
        log.debug('handleGetDesktopSources', {viewName, opts});

        const view = this.viewManager?.views.get(viewName);
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

    handleReloadCurrentView = () => {
        log.debug('handleReloadCurrentView');

        const view = this.viewManager?.getCurrentView();
        if (!view) {
            return;
        }
        view?.reload();
        this.viewManager?.showByName(view?.name);
    }

    getServerURLFromWebContentsId = (id: number) => {
        if (this.callsWidgetWindow && (id === this.callsWidgetWindow.getWebContentsId() || id === this.callsWidgetWindow.getPopOutWebContentsId())) {
            return this.callsWidgetWindow.getURL();
        }

        const viewName = this.getViewNameByWebContentsId(id);
        if (!viewName) {
            return undefined;
        }
        return this.viewManager?.views.get(viewName)?.tab.server.url;
    }
}

const windowManager = new WindowManager();
export default windowManager;
