// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
import path from 'path';

import {app, BrowserWindow, systemPreferences, ipcMain, IpcMainEvent, IpcMainInvokeEvent} from 'electron';

import {
    MAXIMIZE_CHANGE,
    FOCUS_THREE_DOT_MENU,
    GET_DARK_MODE,
    UPDATE_SHORTCUT_MENU,
    GET_VIEW_WEBCONTENTS_ID,
    RESIZE_MODAL,
    VIEW_FINISHED_RESIZING,
} from 'common/communication';
import {Logger} from 'common/log';
import {SECOND} from 'common/utils/constants';
import Config from 'common/config';
import {getTabViewName} from 'common/tabs/TabView';

import downloadsManager from 'main/downloadsManager';
import {MattermostView} from 'main/views/MattermostView';

import {
    getAdjustedWindowBoundaries,
    shouldHaveBackBar,
} from '../utils';

import ViewManager from '../views/viewManager';
import LoadingScreen from '../views/loadingScreen';
import TeamDropdownView from '../views/teamDropdownView';
import DownloadsDropdownView from '../views/downloadsDropdownView';
import DownloadsDropdownMenuView from '../views/downloadsDropdownMenuView';

import MainWindow from './mainWindow';
import CallsWidgetWindow from './callsWidgetWindow';
import SettingsWindow from './settingsWindow';

// singleton module to manage application's windows

const log = new Logger('WindowManager');

export class WindowManager {
    assetsDir: string;

    teamDropdown?: TeamDropdownView;
    downloadsDropdown?: DownloadsDropdownView;
    downloadsDropdownMenu?: DownloadsDropdownMenuView;
    currentServerName?: string;
    missingScreensharePermissions?: boolean;

    constructor() {
        this.assetsDir = path.resolve(app.getAppPath(), 'assets');

        ipcMain.handle(GET_DARK_MODE, this.handleGetDarkMode);
        ipcMain.handle(GET_VIEW_WEBCONTENTS_ID, this.handleGetWebContentsId);
        ipcMain.on(VIEW_FINISHED_RESIZING, this.handleViewFinishedResizing);
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

    setCurrentViewBounds = (bounds: {width: number; height: number}) => {
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
        ViewManager.init();
        this.initializeCurrentServerName();
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
                if (ViewManager.getView(tabViewName)) {
                    ViewManager.showByName(tabViewName);
                    clearTimeout(timeout);
                }
            }, 100);
        } else {
            ViewManager.showByName(tabViewName);
        }
        ipcMain.emit(UPDATE_SHORTCUT_MENU);
    }

    switchTab = (serverName: string, tabName: string) => {
        log.debug('switchTab');
        this.showMainWindow();
        const tabViewName = getTabViewName(serverName, tabName);
        ViewManager.showByName(tabViewName);
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
        const currentView = ViewManager.getCurrentView();
        if (currentView) {
            LoadingScreen.show();
            currentView.reload();
        }
    }

    selectNextTab = () => {
        this.selectTab((order) => order + 1);
    }

    selectPreviousTab = () => {
        this.selectTab((order, length) => (length + (order - 1)));
    }

    selectTab = (fn: (order: number, length: number) => number) => {
        const currentView = ViewManager.getCurrentView();
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

    getCurrentTeamName = () => {
        return this.currentServerName;
    }

    handleGetWebContentsId = (event: IpcMainInvokeEvent) => {
        return event.sender.id;
    }

    getServerURLFromWebContentsId = (id: number) => {
        if (CallsWidgetWindow.isCallsWidget(id)) {
            return CallsWidgetWindow.getURL();
        }

        return ViewManager.getViewByWebContentsId(id)?.tab.server.url;
    }
}

const windowManager = new WindowManager();
export default windowManager;
