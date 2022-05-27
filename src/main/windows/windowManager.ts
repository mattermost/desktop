// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
import path from 'path';

import {app, BrowserWindow, nativeImage, systemPreferences, ipcMain, IpcMainEvent, IpcMainInvokeEvent, desktopCapturer} from 'electron';
import log from 'electron-log';

import {
    MAXIMIZE_CHANGE,
    HISTORY,
    GET_LOADING_SCREEN_DATA,
    REACT_APP_INITIALIZED,
    LOADING_SCREEN_ANIMATION_FINISHED,
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
} from 'common/communication';
import urlUtils from 'common/utils/url';
import {SECOND} from 'common/utils/constants';
import Config from 'common/config';
import {getTabViewName, TAB_MESSAGING} from 'common/tabs/TabView';

import {getAdjustedWindowBoundaries, shouldHaveBackBar} from '../utils';

import {ViewManager} from '../views/viewManager';
import CriticalErrorHandler from '../CriticalErrorHandler';

import TeamDropdownView from '../views/teamDropdownView';

import {createSettingsWindow} from './settingsWindow';
import createMainWindow from './mainWindow';

// singleton module to manage application's windows

export class WindowManager {
    assetsDir: string;

    mainWindow?: BrowserWindow;
    mainWindowReady: boolean;
    settingsWindow?: BrowserWindow;
    viewManager?: ViewManager;
    teamDropdown?: TeamDropdownView;
    currentServerName?: string;

    constructor() {
        this.mainWindowReady = false;
        this.assetsDir = path.resolve(app.getAppPath(), 'assets');

        ipcMain.on(HISTORY, this.handleHistory);
        ipcMain.handle(GET_LOADING_SCREEN_DATA, this.handleLoadingScreenDataRequest);
        ipcMain.handle(GET_DARK_MODE, this.handleGetDarkMode);
        ipcMain.on(REACT_APP_INITIALIZED, this.handleReactAppInitialized);
        ipcMain.on(LOADING_SCREEN_ANIMATION_FINISHED, this.handleLoadingScreenAnimationFinished);
        ipcMain.on(BROWSER_HISTORY_PUSH, this.handleBrowserHistoryPush);
        ipcMain.on(BROWSER_HISTORY_BUTTON, this.handleBrowserHistoryButton);
        ipcMain.on(APP_LOGGED_IN, this.handleAppLoggedIn);
        ipcMain.on(APP_LOGGED_OUT, this.handleAppLoggedOut);
        ipcMain.handle(GET_VIEW_NAME, this.handleGetViewName);
        ipcMain.handle(GET_VIEW_WEBCONTENTS_ID, this.handleGetWebContentsId);
        ipcMain.on(DISPATCH_GET_DESKTOP_SOURCES, this.handleGetDesktopSources);
        ipcMain.on(RELOAD_CURRENT_VIEW, this.handleReloadCurrentView);
    }

    handleUpdateConfig = () => {
        if (this.viewManager) {
            this.viewManager.reloadConfiguration(Config.teams || []);
        }
    }

    showSettingsWindow = () => {
        log.debug('WindowManager.showSettingsWindow');

        if (this.settingsWindow) {
            this.settingsWindow.show();
        } else {
            if (!this.mainWindow) {
                this.showMainWindow();
            }
            const withDevTools = Boolean(process.env.MM_DEBUG_SETTINGS) || false;

            this.settingsWindow = createSettingsWindow(this.mainWindow!, withDevTools);
            this.settingsWindow.on('closed', () => {
                delete this.settingsWindow;
            });
        }
    }

    showMainWindow = (deeplinkingURL?: string | URL) => {
        log.debug('WindowManager.showMainWindow', deeplinkingURL);

        if (this.mainWindow) {
            if (this.mainWindow.isVisible()) {
                this.mainWindow.focus();
            } else {
                this.mainWindow.show();
            }
        } else {
            this.mainWindowReady = false;
            this.mainWindow = createMainWindow({
                linuxAppIcon: path.join(this.assetsDir, 'linux', 'app_icon.png'),
            });

            if (!this.mainWindow) {
                log.error('unable to create main window');
                app.quit();
                return;
            }

            this.mainWindow.once('ready-to-show', () => {
                this.mainWindowReady = true;
            });

            // window handlers
            this.mainWindow.on('closed', () => {
                log.warn('main window closed');
                delete this.mainWindow;
                this.mainWindowReady = false;
            });
            this.mainWindow.on('unresponsive', () => {
                CriticalErrorHandler.setMainWindow(this.mainWindow!);
                CriticalErrorHandler.windowUnresponsiveHandler();
            });
            this.mainWindow.on('maximize', this.handleMaximizeMainWindow);
            this.mainWindow.on('unmaximize', this.handleUnmaximizeMainWindow);
            this.mainWindow.on('resize', this.handleResizeMainWindow);
            this.mainWindow.on('focus', this.focusBrowserView);
            this.mainWindow.on('enter-full-screen', () => this.sendToRenderer('enter-full-screen'));
            this.mainWindow.on('leave-full-screen', () => this.sendToRenderer('leave-full-screen'));

            if (process.env.MM_DEBUG_SETTINGS) {
                this.mainWindow.webContents.openDevTools({mode: 'detach'});
            }

            if (this.viewManager) {
                this.viewManager.updateMainWindow(this.mainWindow);
            }

            this.teamDropdown = new TeamDropdownView(this.mainWindow, Config.teams, Config.darkMode, Config.enableServerManagement);
        }
        this.initializeViewManager();

        if (deeplinkingURL) {
            this.viewManager!.handleDeepLink(deeplinkingURL);
        }
    }

    getMainWindow = (ensureCreated?: boolean) => {
        if (ensureCreated && !this.mainWindow) {
            this.showMainWindow();
        }
        return this.mainWindow;
    }

    on = this.mainWindow?.on;

    handleMaximizeMainWindow = () => {
        this.sendToRenderer(MAXIMIZE_CHANGE, true);
    }

    handleUnmaximizeMainWindow = () => {
        this.sendToRenderer(MAXIMIZE_CHANGE, false);
    }

    handleResizeMainWindow = () => {
        log.debug('WindowManager.handleResizeMainWindow');

        if (!(this.viewManager && this.mainWindow)) {
            return;
        }
        const currentView = this.viewManager.getCurrentView();
        let bounds: Partial<Electron.Rectangle>;

        // Workaround for linux maximizing/minimizing, which doesn't work properly because of these bugs:
        // https://github.com/electron/electron/issues/28699
        // https://github.com/electron/electron/issues/28106
        if (process.platform === 'linux') {
            const size = this.mainWindow.getSize();
            bounds = {width: size[0], height: size[1]};
        } else {
            bounds = this.mainWindow.getContentBounds();
        }

        const setBoundsFunction = () => {
            if (currentView) {
                currentView.setBounds(getAdjustedWindowBoundaries(bounds.width!, bounds.height!, shouldHaveBackBar(currentView.tab.url, currentView.view.webContents.getURL())));
            }
        };

        // Another workaround since the window doesn't update properly under Linux for some reason
        // See above comment
        if (process.platform === 'linux') {
            setTimeout(setBoundsFunction, 10);
        } else {
            setBoundsFunction();
        }
        this.viewManager.setLoadingScreenBounds();
        this.teamDropdown?.updateWindowBounds();
        ipcMain.emit(RESIZE_MODAL, null, bounds);
    }

    // max retries allows the message to get to the renderer even if it is sent while the app is starting up.
    sendToRendererWithRetry = (maxRetries: number, channel: string, ...args: any[]) => {
        if (!this.mainWindow || !this.mainWindowReady) {
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
        this.mainWindow!.webContents.send(channel, ...args);
        if (this.settingsWindow && this.settingsWindow.isVisible()) {
            try {
                this.settingsWindow.webContents.send(channel, ...args);
            } catch (e) {
                log.error(`There was an error while trying to communicate with the renderer: ${e}`);
            }
        }
    }

    sendToRenderer = (channel: string, ...args: any[]) => {
        this.sendToRendererWithRetry(3, channel, ...args);
    }

    sendToAll = (channel: string, ...args: any[]) => {
        this.sendToRenderer(channel, ...args);
        if (this.settingsWindow) {
            this.settingsWindow.webContents.send(channel, ...args);
        }

        // TODO: should we include popups?
    }

    sendToMattermostViews = (channel: string, ...args: any[]) => {
        if (this.viewManager) {
            this.viewManager.sendToAllViews(channel, ...args);
        }
    }

    restoreMain = () => {
        log.info('restoreMain');
        if (!this.mainWindow) {
            this.showMainWindow();
        }
        if (!this.mainWindow!.isVisible() || this.mainWindow!.isMinimized()) {
            if (this.mainWindow!.isMinimized()) {
                this.mainWindow!.restore();
            } else {
                this.mainWindow!.show();
            }
            if (this.settingsWindow) {
                this.settingsWindow.focus();
            } else {
                this.mainWindow!.focus();
            }
        } else if (this.settingsWindow) {
            this.settingsWindow.focus();
        } else {
            this.mainWindow!.focus();
        }
    }

    flashFrame = (flash: boolean) => {
        if (process.platform === 'linux' || process.platform === 'win32') {
            if (Config.notifications.flashWindow) {
                this.mainWindow?.flashFrame(flash);
            }
        }
        if (process.platform === 'darwin' && Config.notifications.bounceIcon) {
            app.dock.bounce(Config.notifications.bounceIconType);
        }
    }

    drawBadge = (text: string, small: boolean) => {
        const scale = 2; // should rely display dpi
        const size = (small ? 20 : 16) * scale;
        const canvas = document.createElement('canvas');
        canvas.setAttribute('width', `${size}`);
        canvas.setAttribute('height', `${size}`);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            log.error('Could not create canvas context');
            return null;
        }

        // circle
        ctx.fillStyle = '#FF1744'; // Material Red A400
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = (11 * scale) + 'px sans-serif';
        ctx.fillText(text, size / 2, size / 2, size);

        return canvas.toDataURL();
    }

    createDataURL = (text: string, small: boolean) => {
        const win = this.mainWindow;
        if (!win) {
            return null;
        }

        // since we don't have a document/canvas object in the main process, we use the webcontents from the window to draw.
        const safeSmall = Boolean(small);
        const code = `
        window.drawBadge = ${this.drawBadge};
        window.drawBadge('${text || ''}', ${safeSmall});
      `;
        return win.webContents.executeJavaScript(code);
    }

    setOverlayIcon = async (badgeText: string | undefined, description: string, small: boolean) => {
        if (process.platform === 'win32') {
            let overlay = null;
            if (this.mainWindow) {
                if (badgeText) {
                    try {
                        const dataUrl = await this.createDataURL(badgeText, small);
                        overlay = nativeImage.createFromDataURL(dataUrl);
                    } catch (err) {
                        log.error(`Couldn't generate a badge: ${err}`);
                    }
                }
                this.mainWindow.setOverlayIcon(overlay, description);
            }
        }
    }

    isMainWindow = (window: BrowserWindow) => {
        return this.mainWindow && this.mainWindow === window;
    }

    handleDoubleClick = (e: IpcMainEvent, windowType?: string) => {
        log.debug('WindowManager.handleDoubleClick', windowType);

        let action = 'Maximize';
        if (process.platform === 'darwin') {
            action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
        }
        const win = (windowType === 'settings') ? this.settingsWindow : this.mainWindow;
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
        if (!this.viewManager && Config && this.mainWindow) {
            this.viewManager = new ViewManager(this.mainWindow);
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
        this.showMainWindow();
        const tabViewName = getTabViewName(serverName, tabName);
        this.viewManager?.showByName(tabViewName);
    }

    focusBrowserView = () => {
        log.debug('WindowManager.focusBrowserView');

        if (this.viewManager) {
            this.viewManager.focus();
        } else {
            log.error('Trying to call focus when the viewmanager has not yet been initialized');
        }
    }

    openBrowserViewDevTools = () => {
        if (this.viewManager) {
            this.viewManager.openViewDevTools();
        }
    }

    focusThreeDotMenu = () => {
        if (this.mainWindow) {
            this.mainWindow.webContents.focus();
            this.mainWindow.webContents.send(FOCUS_THREE_DOT_MENU);
        }
    }

    handleLoadingScreenDataRequest = () => {
        return {
            darkMode: Config.darkMode || false,
        };
    }

    handleReactAppInitialized = (e: IpcMainEvent, view: string) => {
        log.debug('WindowManager.handleReactAppInitialized', view);

        if (this.viewManager) {
            this.viewManager.setServerInitialized(view);
        }
    }

    handleLoadingScreenAnimationFinished = () => {
        log.debug('WindowManager.handleLoadingScreenAnimationFinished');

        if (this.viewManager) {
            this.viewManager.hideLoadingScreen();
        }
    }

    updateLoadingScreenDarkMode = (darkMode: boolean) => {
        if (this.viewManager) {
            this.viewManager.updateLoadingScreenDarkMode(darkMode);
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
            this.viewManager?.showLoadingScreen();
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
        log.debug('WindowManager.handleHistory', offset);

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
        log.debug('WwindowManager.handleBrowserHistoryPush', {viewName, pathName});

        const currentView = this.viewManager?.views.get(viewName);
        const cleanedPathName = urlUtils.cleanPathName(currentView?.tab.server.url.pathname || '', pathName);
        const redirectedViewName = urlUtils.getView(`${currentView?.tab.server.url}${cleanedPathName}`, Config.teams)?.name || viewName;
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
        log.debug('EindowManager.handleBrowserHistoryButton', viewName);

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
        log.debug('WindowManager.handleAppLoggedIn', viewName);

        const view = this.viewManager?.views.get(viewName);
        if (view) {
            view.isLoggedIn = true;
            this.viewManager?.reloadViewIfNeeded(viewName);
        }
    }

    handleAppLoggedOut = (event: IpcMainEvent, viewName: string) => {
        log.debug('WindowManager.handleAppLoggedOut', viewName);

        const view = this.viewManager?.views.get(viewName);
        if (view) {
            view.isLoggedIn = false;
        }
    }

    handleGetViewName = (event: IpcMainInvokeEvent) => {
        return this.getViewNameByWebContentsId(event.sender.id);
    }

    handleGetWebContentsId = (event: IpcMainInvokeEvent) => {
        return event.sender.id;
    }

    handleGetDesktopSources = async (event: IpcMainEvent, viewName: string, opts: Electron.SourcesOptions) => {
        log.debug('WindowManager.handleGetDesktopSources', {viewName, opts});

        const view = this.viewManager?.views.get(viewName);
        if (!view) {
            return;
        }

        desktopCapturer.getSources(opts).then((sources) => {
            view.view.webContents.send(DESKTOP_SOURCES_RESULT, sources.map((source) => {
                return {
                    id: source.id,
                    name: source.name,
                    thumbnailURL: source.thumbnail.toDataURL(),
                };
            }));
        });
    }

    handleReloadCurrentView = () => {
        log.debug('WindowManager.handleReloadCurrentView');

        const view = this.viewManager?.getCurrentView();
        if (!view) {
            return;
        }
        view?.reload();
        this.viewManager?.showByName(view?.name);
    }
}

const windowManager = new WindowManager();
export default windowManager;
