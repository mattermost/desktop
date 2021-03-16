// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import {app, BrowserWindow, nativeImage, systemPreferences, ipcMain} from 'electron';
import log from 'electron-log';

import {MAXIMIZE_CHANGE, HISTORY, GET_LOADING_SCREEN_DATA, REACT_APP_INITIALIZED, LOADING_SCREEN_ANIMATION_FINISHED, FOCUS_THREE_DOT_MENU} from 'common/communication';
import urlUtils from 'common/utils/url';

import {getAdjustedWindowBoundaries} from '../utils';

import {ViewManager} from '../views/viewManager';
import {CriticalErrorHandler} from '../CriticalErrorHandler';

import {createSettingsWindow} from './settingsWindow';
import createMainWindow from './mainWindow';

// singleton module to manage application's windows

const status = {
    mainWindow: null,
    settingsWindow: null,
    config: null,
    viewManager: null,
};
const assetsDir = path.resolve(app.getAppPath(), 'assets');

ipcMain.on(HISTORY, handleHistory);
ipcMain.handle(GET_LOADING_SCREEN_DATA, handleLoadingScreenDataRequest);
ipcMain.on(REACT_APP_INITIALIZED, handleReactAppInitialized);
ipcMain.on(LOADING_SCREEN_ANIMATION_FINISHED, handleLoadingScreenAnimationFinished);

export function setConfig(data) {
    if (data) {
        status.config = data;
    }
    if (status.viewManager) {
        status.viewManager.reloadConfiguration(status.config.teams);
    }
}

export function showSettingsWindow() {
    if (status.settingsWindow) {
        status.settingsWindow.show();
    } else {
        if (!status.mainWindow) {
            showMainWindow();
        }
        const withDevTools = process.env.MM_DEBUG_SETTINGS || false;

        status.settingsWindow = createSettingsWindow(status.mainWindow, status.config, withDevTools);
        status.settingsWindow.on('closed', () => {
            status.settingsWindow = null;
            focusBrowserView();
        });
    }
}

export function showMainWindow(deeplinkingURL) {
    if (status.mainWindow) {
        status.mainWindow.show();
    } else {
        status.mainWindow = createMainWindow(status.config, {
            linuxAppIcon: path.join(assetsDir, 'appicon.png'),
        });

        if (!status.mainWindow) {
            log.error('unable to create main window');
            app.quit();
        }

        // window handlers
        status.mainWindow.on('closed', () => {
            log.warn('main window closed');
            status.mainWindow = null;
        });
        status.mainWindow.on('unresponsive', () => {
            const criticalErrorHandler = new CriticalErrorHandler();
            criticalErrorHandler.setMainWindow(status.mainWindow);
            criticalErrorHandler.windowUnresponsiveHandler();
        });
        status.mainWindow.on('crashed', handleMainWindowWebContentsCrashed);
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
    }
    initializeViewManager();

    if (deeplinkingURL) {
        status.viewManager.handleDeepLink(deeplinkingURL);
    }
}

export function getMainWindow(ensureCreated) {
    if (ensureCreated && status.mainWindow === null) {
        showMainWindow();
    }
    return status.mainWindow;
}

export function on(event, listener) {
    return status.mainWindow.on(event, listener);
}

function handleMainWindowWebContentsCrashed() {
    throw new Error('webContents \'crashed\' event has been emitted');
}

function handleMaximizeMainWindow() {
    sendToRenderer(MAXIMIZE_CHANGE, true);
}

function handleUnmaximizeMainWindow() {
    sendToRenderer(MAXIMIZE_CHANGE, false);
}

function handleResizeMainWindow(event, newBounds) {
    setBoundsForCurrentView(event, newBounds);
}

function setBoundsForCurrentView(event, newBounds) {
    const currentView = status.viewManager.getCurrentView();
    const bounds = newBounds || status.mainWindow.getContentBounds();
    if (currentView) {
        currentView.setBounds(getAdjustedWindowBoundaries(bounds.width, bounds.height, !urlUtils.isTeamUrl(currentView.server.url, currentView.view.webContents.getURL())));
    }
    status.viewManager.setLoadingScreenBounds();
}

export function sendToRenderer(channel, ...args) {
    if (!status.mainWindow) {
        showMainWindow();
    }
    status.mainWindow.webContents.send(channel, ...args);
    if (status.settingsWindow && status.settingsWindow.isVisible()) {
        status.settingsWindow.webContents.send(channel, ...args);
    }
}

export function sendToAll(channel, ...args) {
    sendToRenderer(channel, ...args);
    if (status.settingsWindow) {
        status.settingsWindow.webContents.send(channel, ...args);
    }

    // TODO: should we include popups?
}

export function sendToMattermostViews(channel, ...args) {
    if (status.viewManager) {
        status.viewManager.sendToAllViews(channel, ...args);
    }
}

export function restoreMain() {
    log.info('restoreMain');
    if (!status.mainWindow) {
        showMainWindow();
    }
    if (!status.mainWindow.isVisible() || status.mainWindow.isMinimized()) {
        if (status.mainWindow.isMinimized()) {
            status.mainWindow.restore();
        } else {
            status.mainWindow.show();
        }
        if (status.settingsWindow) {
            status.settingsWindow.focus();
        } else {
            status.mainWindow.focus();
        }
        if (process.platform === 'darwin') {
            app.dock.show();
        }
    } else if (status.settingsWindow) {
        status.settingsWindow.focus();
    } else {
        status.mainWindow.focus();
    }
}

export function flashFrame(flash) {
    if (process.platform === 'linux' || process.platform === 'win32') {
        status.mainWindow.flashFrame(flash);
        if (status.settingsWindow) {
            // main might be hidden behind the settings
            status.settingsWindow.flashFrame(flash);
        }
    }
    if (process.platform === 'darwin' && status.config.notifications.bounceIcon) {
        app.dock.bounce(status.config.notifications.bounceIconType);
    }
}

function drawBadge(text, small) {
    const scale = 2; // should rely display dpi
    const size = (small ? 20 : 16) * scale;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', size);
    canvas.setAttribute('height', size);
    const ctx = canvas.getContext('2d');

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

function createDataURL(text, small) {
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

export async function setOverlayIcon(badgeText, description, small) {
    if (process.platform === 'win32') {
        let overlay = null;
        if (status.mainWindow && badgeText) {
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

export function isMainWindow(window) {
    return status.mainWindow && status.mainWindow === window;
}

export function handleDoubleClick(e, windowType) {
    let action = 'Maximize';
    if (process.platform === 'darwin') {
        action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
    }
    const win = (windowType === 'settings') ? status.settingsWindow : status.mainWindow;
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
    if (!status.viewManager) {
        status.viewManager = new ViewManager(status.config, status.mainWindow);
        status.viewManager.load();
        status.viewManager.showInitial();
    }
}

export function switchServer(serverName) {
    showMainWindow();
    status.viewManager.showByName(serverName);
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
        darkMode: status.config.darkMode,
    };
}

function handleReactAppInitialized(_, server) {
    if (status.viewManager) {
        status.viewManager.setServerInitialized(server);
    }
}

function handleLoadingScreenAnimationFinished() {
    if (status.viewManager) {
        status.viewManager.hideLoadingScreen();
    }
}

export function updateLoadingScreenDarkMode(darkMode) {
    if (status.viewManager) {
        status.viewManager.updateLoadingScreenDarkMode(darkMode);
    }
}

export function getServerNameByWebContentsId(webContentsId) {
    if (status.viewManager) {
        return status.viewManager.findByWebContent(webContentsId);
    }
    return null;
}

export function close() {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused.id === status.mainWindow.id) {
    // TODO: figure out logic for closing
        focused.close();
    } else {
        focused.close();
    }
}
export function maximize() {
    const focused = BrowserWindow.getFocusedWindow();
    focused.maximize();
}
export function minimize() {
    const focused = BrowserWindow.getFocusedWindow();
    focused.minimize();
}
export function restore() {
    const focused = BrowserWindow.getFocusedWindow();
    focused.restore();
}

export function reload() {
    const currentView = status.viewManager.getCurrentView();
    if (currentView) {
        status.viewManager.showLoadingScreen();
        currentView.reload();
    }
}

export function handleHistory(event, offset) {
    if (status.viewManager) {
        const activeView = status.viewManager.getCurrentView();
        if (activeView && activeView.view.webContents.canGoToOffset(offset)) {
            try {
                activeView.view.webContents.goToOffset(offset);
            } catch (error) {
                log.error(error);
                activeView.load(activeView.server.url);
            }
        }
    }
}
