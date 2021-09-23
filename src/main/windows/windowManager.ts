// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import {app, BrowserWindow, nativeImage, systemPreferences, ipcMain, IpcMainEvent} from 'electron';
import log from 'electron-log';

import {CombinedConfig} from 'types/config';

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
} from 'common/communication';
import urlUtils from 'common/utils/url';

import {getTabViewName} from 'common/tabs/TabView';

import {getAdjustedWindowBoundaries} from '../utils';

import {ViewManager} from '../views/viewManager';
import CriticalErrorHandler from '../CriticalErrorHandler';

import TeamDropdownView from '../views/teamDropdownView';

import {createSettingsWindow} from './settingsWindow';
import createMainWindow from './mainWindow';

// singleton module to manage application's windows

type WindowManagerStatus = {
    mainWindow?: BrowserWindow;
    settingsWindow?: BrowserWindow;
    config?: CombinedConfig;
    viewManager?: ViewManager;
    teamDropdown?: TeamDropdownView;
    currentServerName?: string;
};

const status: WindowManagerStatus = {};
const assetsDir = path.resolve(app.getAppPath(), 'assets');

ipcMain.on(HISTORY, handleHistory);
ipcMain.handle(GET_LOADING_SCREEN_DATA, handleLoadingScreenDataRequest);
ipcMain.handle(GET_DARK_MODE, handleGetDarkMode);
ipcMain.on(REACT_APP_INITIALIZED, handleReactAppInitialized);
ipcMain.on(LOADING_SCREEN_ANIMATION_FINISHED, handleLoadingScreenAnimationFinished);
ipcMain.on(BROWSER_HISTORY_PUSH, handleBrowserHistoryPush);
ipcMain.on(APP_LOGGED_IN, handleAppLoggedIn);

export function setConfig(data: CombinedConfig) {
    if (data) {
        status.config = data;
    }
    if (status.viewManager && status.config) {
        status.viewManager.reloadConfiguration(status.config.teams || []);
    }
}

export function showSettingsWindow() {
    if (status.settingsWindow) {
        status.settingsWindow.show();
    } else {
        if (!status.mainWindow) {
            showMainWindow();
        }
        const withDevTools = Boolean(process.env.MM_DEBUG_SETTINGS) || false;

        if (!status.config) {
            return;
        }
        status.settingsWindow = createSettingsWindow(status.mainWindow!, status.config, withDevTools);
        status.settingsWindow.on('closed', () => {
            delete status.settingsWindow;
            focusBrowserView();
        });
    }
}

export function showMainWindow(deeplinkingURL?: string | URL) {
    if (status.mainWindow) {
        if (status.mainWindow.isVisible()) {
            status.mainWindow.focus();
        } else {
            status.mainWindow.show();
        }
    } else {
        if (!status.config) {
            return;
        }
        status.mainWindow = createMainWindow(status.config, {
            linuxAppIcon: path.join(assetsDir, 'linux', 'app_icon.png'),
        });

        if (!status.mainWindow) {
            log.error('unable to create main window');
            app.quit();
        }

        // window handlers
        status.mainWindow.on('closed', () => {
            log.warn('main window closed');
            delete status.mainWindow;
        });
        status.mainWindow.on('unresponsive', () => {
            const criticalErrorHandler = new CriticalErrorHandler();
            criticalErrorHandler.setMainWindow(status.mainWindow!);
            criticalErrorHandler.windowUnresponsiveHandler();
        });
        status.mainWindow.on('maximize', handleMaximizeMainWindow);
        status.mainWindow.on('unmaximize', handleUnmaximizeMainWindow);
        status.mainWindow.on('resize', handleResizeMainWindow);
        status.mainWindow.on('focus', focusBrowserView);
        status.mainWindow.on('enter-full-screen', () => sendToRenderer('enter-full-screen'));
        status.mainWindow.on('leave-full-screen', () => sendToRenderer('leave-full-screen'));

        if (process.env.MM_DEBUG_SETTINGS) {
            status.mainWindow.webContents.openDevTools({mode: 'detach'});
        }

        if (status.viewManager) {
            status.viewManager.updateMainWindow(status.mainWindow);
        }

        status.teamDropdown = new TeamDropdownView(status.mainWindow, status.config.teams, status.config.darkMode, status.config.enableServerManagement);
    }
    initializeViewManager();

    if (deeplinkingURL) {
        status.viewManager!.handleDeepLink(deeplinkingURL);
    }
}

export function getMainWindow(ensureCreated?: boolean) {
    if (ensureCreated && !status.mainWindow) {
        showMainWindow();
    }
    return status.mainWindow;
}

export const on = status.mainWindow?.on;

function handleMaximizeMainWindow() {
    sendToRenderer(MAXIMIZE_CHANGE, true);
}

function handleUnmaximizeMainWindow() {
    sendToRenderer(MAXIMIZE_CHANGE, false);
}

function handleResizeMainWindow() {
    if (!(status.viewManager && status.mainWindow)) {
        return;
    }
    const currentView = status.viewManager.getCurrentView();
    let bounds: Partial<Electron.Rectangle>;

    // Workaround for linux maximizing/minimizing, which doesn't work properly because of these bugs:
    // https://github.com/electron/electron/issues/28699
    // https://github.com/electron/electron/issues/28106
    if (process.platform === 'linux') {
        const size = status.mainWindow.getSize();
        bounds = {width: size[0], height: size[1]};
    } else {
        bounds = status.mainWindow.getContentBounds();
    }

    const setBoundsFunction = () => {
        if (currentView) {
            currentView.setBounds(getAdjustedWindowBoundaries(bounds.width!, bounds.height!, !(urlUtils.isTeamUrl(currentView.tab.url, currentView.view.webContents.getURL()) || urlUtils.isAdminUrl(currentView.tab.url, currentView.view.webContents.getURL()))));
        }
    };

    // Another workaround since the window doesn't update properly under Linux for some reason
    // See above comment
    if (process.platform === 'linux') {
        setTimeout(setBoundsFunction, 10);
    } else {
        setBoundsFunction();
    }
    status.viewManager.setLoadingScreenBounds();
    status.teamDropdown?.updateWindowBounds();
}

export function sendToRenderer(channel: string, ...args: any[]) {
    if (!status.mainWindow) {
        showMainWindow();
    }
    status.mainWindow!.webContents.send(channel, ...args);
    if (status.settingsWindow && status.settingsWindow.isVisible()) {
        status.settingsWindow.webContents.send(channel, ...args);
    }
}

export function sendToAll(channel: string, ...args: any[]) {
    sendToRenderer(channel, ...args);
    if (status.settingsWindow) {
        status.settingsWindow.webContents.send(channel, ...args);
    }

    // TODO: should we include popups?
}

export function sendToMattermostViews(channel: string, ...args: any[]) {
    if (status.viewManager) {
        status.viewManager.sendToAllViews(channel, ...args);
    }
}

export function restoreMain() {
    log.info('restoreMain');
    if (!status.mainWindow) {
        showMainWindow();
    }
    if (!status.mainWindow!.isVisible() || status.mainWindow!.isMinimized()) {
        if (status.mainWindow!.isMinimized()) {
            status.mainWindow!.restore();
        } else {
            status.mainWindow!.show();
        }
        if (status.settingsWindow) {
            status.settingsWindow.focus();
        } else {
            status.mainWindow!.focus();
        }
        if (process.platform === 'darwin') {
            app.dock.show();
        }
    } else if (status.settingsWindow) {
        status.settingsWindow.focus();
    } else {
        status.mainWindow!.focus();
    }
}

export function flashFrame(flash: boolean) {
    if (process.platform === 'linux' || process.platform === 'win32') {
        if (status.config?.notifications.flashWindow) {
            status.mainWindow?.flashFrame(flash);
            if (status.settingsWindow) {
                // main might be hidden behind the settings
                status.settingsWindow.flashFrame(flash);
            }
        }
    }
    if (process.platform === 'darwin' && status.config?.notifications.bounceIcon) {
        app.dock.bounce(status.config?.notifications.bounceIconType);
    }
}

function drawBadge(text: string, small: boolean) {
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

function createDataURL(text: string, small: boolean) {
    const win = status.mainWindow;
    if (!win) {
        return null;
    }

    // since we don't have a document/canvas object in the main process, we use the webcontents from the window to draw.
    const safeSmall = Boolean(small);
    const code = `
    window.drawBadge = ${drawBadge};
    window.drawBadge('${text || ''}', ${safeSmall});
  `;
    return win.webContents.executeJavaScript(code);
}

export async function setOverlayIcon(badgeText: string | undefined, description: string, small: boolean) {
    if (process.platform === 'win32') {
        let overlay = null;
        if (status.mainWindow) {
            if (badgeText) {
                try {
                    const dataUrl = await createDataURL(badgeText, small);
                    overlay = nativeImage.createFromDataURL(dataUrl);
                } catch (err) {
                    log.error(`Couldn't generate a badge: ${err}`);
                }
            }
            status.mainWindow.setOverlayIcon(overlay, description);
        }
    }
}

export function isMainWindow(window: BrowserWindow) {
    return status.mainWindow && status.mainWindow === window;
}

export function handleDoubleClick(e: IpcMainEvent, windowType?: string) {
    let action = 'Maximize';
    if (process.platform === 'darwin') {
        action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
    }
    const win = (windowType === 'settings') ? status.settingsWindow : status.mainWindow;
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

function initializeViewManager() {
    if (!status.viewManager && status.config && status.mainWindow) {
        status.viewManager = new ViewManager(status.config, status.mainWindow);
        status.viewManager.load();
        status.viewManager.showInitial();
        status.currentServerName = (status.config.teams.find((team) => team.order === status.config?.lastActiveTeam) || status.config.teams.find((team) => team.order === 0))?.name;
    }
}

export function switchServer(serverName: string, waitForViewToExist = false) {
    showMainWindow();
    const server = status.config?.teams.find((team) => team.name === serverName);
    if (!server) {
        log.error('Cannot find server in config');
        return;
    }
    status.currentServerName = serverName;
    let nextTab = server.tabs.find((tab) => tab.isOpen && tab.order === (server.lastActiveTab || 0));
    if (!nextTab) {
        const openTabs = server.tabs.filter((tab) => tab.isOpen);
        nextTab = openTabs.find((e) => e.order === 0) || openTabs[0];
    }
    const tabViewName = getTabViewName(serverName, nextTab.name);
    if (waitForViewToExist) {
        const timeout = setInterval(() => {
            if (status.viewManager?.views.has(tabViewName)) {
                status.viewManager?.showByName(tabViewName);
                clearTimeout(timeout);
            }
        }, 100);
    } else {
        status.viewManager?.showByName(tabViewName);
    }
    ipcMain.emit(UPDATE_SHORTCUT_MENU);
}

export function switchTab(serverName: string, tabName: string) {
    showMainWindow();
    const tabViewName = getTabViewName(serverName, tabName);
    status.viewManager?.showByName(tabViewName);
}

export function focusBrowserView() {
    if (status.viewManager) {
        status.viewManager.focus();
    } else {
        log.error('Trying to call focus when the viewmanager has not yet been initialized');
    }
}

export function openBrowserViewDevTools() {
    if (status.viewManager) {
        status.viewManager.openViewDevTools();
    }
}

export function focusThreeDotMenu() {
    if (status.mainWindow) {
        status.mainWindow.webContents.focus();
        status.mainWindow.webContents.send(FOCUS_THREE_DOT_MENU);
    }
}

function handleLoadingScreenDataRequest() {
    return {
        darkMode: status.config?.darkMode || false,
    };
}

function handleReactAppInitialized(e: IpcMainEvent, view: string) {
    if (status.viewManager) {
        status.viewManager.setServerInitialized(view);
    }
}

function handleLoadingScreenAnimationFinished() {
    if (status.viewManager) {
        status.viewManager.hideLoadingScreen();
    }
}

export function updateLoadingScreenDarkMode(darkMode: boolean) {
    if (status.viewManager) {
        status.viewManager.updateLoadingScreenDarkMode(darkMode);
    }
}

export function getViewNameByWebContentsId(webContentsId: number) {
    const view = status.viewManager?.findViewByWebContent(webContentsId);
    return view?.name;
}

export function getServerNameByWebContentsId(webContentsId: number) {
    const view = status.viewManager?.findViewByWebContent(webContentsId);
    return view?.tab.server.name;
}

export function close() {
    const focused = BrowserWindow.getFocusedWindow();
    focused?.close();
}
export function maximize() {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused) {
        focused.maximize();
    }
}
export function minimize() {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused) {
        focused.minimize();
    }
}
export function restore() {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused) {
        focused.restore();
    }
    if (focused?.isFullScreen()) {
        focused.setFullScreen(false);
    }
}

export function reload() {
    const currentView = status.viewManager?.getCurrentView();
    if (currentView) {
        status.viewManager?.showLoadingScreen();
        currentView.reload();
    }
}

export function sendToFind() {
    const currentView = status.viewManager?.getCurrentView();
    if (currentView) {
        currentView.view.webContents.sendInputEvent({type: 'keyDown', keyCode: 'F', modifiers: [process.platform === 'darwin' ? 'cmd' : 'ctrl', 'shift']});
    }
}

export function handleHistory(event: IpcMainEvent, offset: number) {
    if (status.viewManager) {
        const activeView = status.viewManager.getCurrentView();
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

export function selectNextTab() {
    const currentView = status.viewManager?.getCurrentView();
    if (!currentView) {
        return;
    }

    const currentTeamTabs = status.config?.teams.find((team) => team.name === currentView.tab.server.name)?.tabs;
    const filteredTabs = currentTeamTabs?.filter((tab) => tab.isOpen);
    const currentTab = currentTeamTabs?.find((tab) => tab.name === currentView.tab.type);
    if (!currentTeamTabs || !currentTab || !filteredTabs) {
        return;
    }

    let currentOrder = currentTab.order;
    let nextIndex = -1;
    while (nextIndex === -1) {
        const nextOrder = ((currentOrder + 1) % currentTeamTabs.length);
        nextIndex = filteredTabs.findIndex((tab) => tab.order === nextOrder);
        currentOrder = nextOrder;
    }

    const newTab = filteredTabs[nextIndex];
    switchTab(currentView.tab.server.name, newTab.name);
}

export function selectPreviousTab() {
    const currentView = status.viewManager?.getCurrentView();
    if (!currentView) {
        return;
    }

    const currentTeamTabs = status.config?.teams.find((team) => team.name === currentView.tab.server.name)?.tabs;
    const filteredTabs = currentTeamTabs?.filter((tab) => tab.isOpen);
    const currentTab = currentTeamTabs?.find((tab) => tab.name === currentView.tab.type);
    if (!currentTeamTabs || !currentTab || !filteredTabs) {
        return;
    }

    // js modulo operator returns a negative number if result is negative, so we have to ensure it's positive
    let currentOrder = currentTab.order;
    let nextIndex = -1;
    while (nextIndex === -1) {
        const nextOrder = ((currentTeamTabs.length + (currentOrder - 1)) % currentTeamTabs.length);
        nextIndex = filteredTabs.findIndex((tab) => tab.order === nextOrder);
        currentOrder = nextOrder;
    }

    const newTab = filteredTabs[nextIndex];
    switchTab(currentView.tab.server.name, newTab.name);
}

function handleGetDarkMode() {
    return status.config?.darkMode;
}

function handleBrowserHistoryPush(e: IpcMainEvent, viewName: string, pathName: string) {
    const currentView = status.viewManager?.views.get(viewName);
    const redirectedViewName = urlUtils.getView(`${currentView?.tab.server.url}${pathName}`, status.config!.teams)?.name || viewName;
    if (status.viewManager?.closedViews.has(redirectedViewName)) {
        status.viewManager.openClosedTab(redirectedViewName, `${currentView?.tab.server.url}${pathName}`);
    }
    const redirectedView = status.viewManager?.views.get(redirectedViewName) || currentView;
    if (redirectedView !== currentView && redirectedView?.tab.server.name === status.currentServerName) {
        log.info('redirecting to a new view', redirectedView?.name || viewName);
        status.viewManager?.showByName(redirectedView?.name || viewName);
    }
    redirectedView?.view.webContents.send(BROWSER_HISTORY_PUSH, pathName);
}

export function getCurrentTeamName() {
    return status.currentServerName;
}

function handleAppLoggedIn(event: IpcMainEvent, viewName: string) {
    status.viewManager?.reloadViewIfNeeded(viewName);
}
