// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import {app, nativeImage} from 'electron';
import log from 'electron-log';

import {createSettingsWindow} from './settingsWindow';
import createMainWindow from './mainWindow';
import {CriticalErrorHandler} from './../CriticalErrorHandler';

// singleton module to manage application's windows

const status = {
  mainWindow: null,
  settingsWindow: null,
  config: null,
  showTrayIcon: process.platform === 'win32',
  deeplinkingUrl: null,
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
}

export function showSettingsWindow() {
  if (status.settingsWindow) {
    status.settingsWindow.show();
  } else {
    if (!status.mainWindow) {
      showMainWindow();
    }
    status.settingsWindow = createSettingsWindow(status.mainWindow, status.config);
    status.settingsWindow.on('close', () => {
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
    status.mainWindow.on('close', () => {
      status.mainWindow = null;
    });
    status.mainWindow.on('unresponsive', () => {
      const criticalErrorHandler = new CriticalErrorHandler();
      criticalErrorHandler.setMainWindow(status.mainWindow);
      criticalErrorHandler.windowUnresponsiveHandler();
    });
    status.mainWindow.on('crashed', handleMainWindowWebContentsCrashed);
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

export function sendToRenderer(channel, ...args) {
  if (!status.mainWindow) {
    showMainWindow();
  }
  status.mainWindow.webContents.send(channel, ...args);
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