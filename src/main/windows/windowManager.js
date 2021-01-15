// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import {app, BrowserWindow, nativeImage, systemPreferences} from 'electron';
import log from 'electron-log';

import {MAXIMIZE_CHANGE, SWITCH_SERVER} from 'common/communication';

import {ViewManager} from '../viewManager';
import {CriticalErrorHandler} from '../CriticalErrorHandler';

import {createSettingsWindow} from './settingsWindow';
import createMainWindow from './mainWindow';

// singleton module to manage application's windows

const status = {
  mainWindow: null,
  settingsWindow: null,
  config: null,
  showTrayIcon: process.platform === 'win32',
  deeplinkingUrl: null,
  viewManager: null,
};
const assetsDir = path.resolve(app.getAppPath(), 'assets');

export function setConfig(data, showTrayIcon, deeplinkingUrl) {
  if (data) {
    status.config = data;
  }
  if (showTrayIcon) {
    status.showTrayIcon = process.platform === 'win32' || showTrayIcon;
  }
  if (deeplinkingUrl) {
    status.deeplinkingUrl = deeplinkingUrl;
  }
  if (status.viewManager) {
    status.viewManager.reloadConfiguration(status.config.teams, status.mainWindow);
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
      // TODO: should we focus on the main window?
      status.settingsWindow = null;
    });
  }
}

export function showMainWindow() {
  if (status.mainWindow) {
    status.mainWindow.show();
  } else {
    status.mainWindow = createMainWindow(status.config, {
      trayIconShown: status.showTrayIcon,
      linuxAppIcon: path.join(assetsDir, 'appicon.png'),
      deeplinkingUrl: status.deeplinkingUrl,
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
    status.mainWindow.on('maximize', () => this.sendToRenderer(MAXIMIZE_CHANGE, true));
    status.mainWindow.on('unmaximize', () => this.sendToRenderer(MAXIMIZE_CHANGE, false));
  }
  initializeViewManager();
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

export function sendToRenderer(channel, ...args) {
  if (!status.mainWindow) {
    showMainWindow();
  }
  status.mainWindow.webContents.send(channel, ...args);
}

export function sendToAll(channel, ...args) {
  sendToRenderer(channel, ...args);
  if (status.settingsWindow) {
    status.settingsWindow.webContents.send(channel, ...args);
  }

  // TODO: should we include popups?
}

// TODO: if settings is displayed, should we focus it instead?
export function restoreMain() {
  if (!status.mainWindow) {
    showMainWindow();
  }
  if (!status.mainWindow.isVisible() || status.mainWindow.isMinimized()) {
    if (status.mainWindow.isMinimized()) {
      status.mainWindow.restore();
    } else {
      status.mainWindow.show();
    }
    status.mainWindow.focus();
    if (process.platform === 'darwin') {
      app.dock.show();
    }
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

export function setOverlayIcon(overlayDataURL, description) {
  if (process.platform === 'win32') {
    const overlay = overlayDataURL ? nativeImage.createFromDataURL(overlayDataURL) : null;
    if (status.mainWindow) {
      status.mainWindow.setOverlayIcon(overlay, description);
    }
  }
}

export function isMainWindow(window) {
  return status.mainWindow && status.mainWindow === window;
}

export function getDeepLinkingURL() {
  return status.deeplinkingUrl;
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
      win.maximize();
    } else {
      win.unmaximize();
    }
    break;
  }
}

function initializeViewManager() {
  if (!status.viewManager) {
    status.viewManager = new ViewManager(status.config);
    status.viewManager.load(status.mainWindow);
    status.viewManager.showInitial();
  }
}

export function switchServer(serverName, notifyRenderer) {
  showMainWindow();
  status.viewManager.showByName(serverName);
  if (notifyRenderer) {
    const server = status.config.teams.find((candidate) => candidate.name === serverName);
    sendToRenderer(SWITCH_SERVER, server.order);
  }
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