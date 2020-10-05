// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';
import path from 'path';
import os from 'os';

import {app, BrowserWindow} from 'electron';

import * as Validator from './Validator';

function saveWindowState(file, window) {
  const windowState = window.getBounds();
  windowState.maximized = window.isMaximized();
  try {
    fs.writeFileSync(file, JSON.stringify(windowState));
  } catch (e) {
    // [Linux] error happens only when the window state is changed before the config dir is created.
    console.log(e);
  }
}

function isFramelessWindow() {
  return os.platform() === 'darwin' || (os.platform() === 'win32' && os.release().startsWith('10'));
}

function createMainWindow(config, options) {
  const defaultWindowWidth = 1000;
  const defaultWindowHeight = 700;
  const minimumWindowWidth = 400;
  const minimumWindowHeight = 240;

  // Create the browser window.
  const boundsInfoPath = path.join(app.getPath('userData'), 'bounds-info.json');
  let windowOptions;
  try {
    windowOptions = JSON.parse(fs.readFileSync(boundsInfoPath, 'utf-8'));
    windowOptions = Validator.validateBoundsInfo(windowOptions);
    if (!windowOptions) {
      throw new Error('Provided bounds info file does not validate, using defaults instead.');
    }
  } catch (e) {
    // Follow Electron's defaults, except for window dimensions which targets 1024x768 screen resolution.
    windowOptions = {width: defaultWindowWidth, height: defaultWindowHeight};
  }

  const {maximized: windowIsMaximized} = windowOptions;

  if (process.platform === 'linux') {
    windowOptions.icon = options.linuxAppIcon;
  }
  Object.assign(windowOptions, {
    title: app.name,
    fullscreenable: true,
    show: false, // don't start the window until it is ready and only if it isn't hidden
    paintWhenInitiallyHidden: true, // we want it to start painting to get info from the webapp
    minWidth: minimumWindowWidth,
    minHeight: minimumWindowHeight,
    frame: !isFramelessWindow(),
    fullscreen: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      disableBlinkFeatures: 'Auxclick',
    },
  });

  const mainWindow = new BrowserWindow(windowOptions);
  mainWindow.deeplinkingUrl = options.deeplinkingUrl;
  mainWindow.setMenuBarVisibility(false);

  const indexURL = global.isDev ? 'http://localhost:8080/browser/index.html' : `file://${app.getAppPath()}/browser/index.html`;
  mainWindow.loadURL(indexURL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.zoomLevel = 0;

    // handle showing the window when not launched by auto-start
    // - when not configured to auto-start, immediately show contents and optionally maximize as needed
    mainWindow.show();
    if (windowIsMaximized) {
      mainWindow.maximize();
    }
  });

  mainWindow.once('show', () => {
    // handle showing the app when hidden to the tray icon by auto-start
    // - optionally maximize the window as needed
    if (windowIsMaximized) {
      mainWindow.maximize();
    }
  });

  mainWindow.once('restore', () => {
    // handle restoring the window when minimized to the app icon by auto-start
    // - optionally maximize the window as needed
    if (windowIsMaximized) {
      mainWindow.maximize();
    }
  });

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences) => {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });

  // App should save bounds when a window is closed.
  // However, 'close' is not fired in some situations(shutdown, ctrl+c)
  // because main process is killed in such situations.
  // 'blur' event was effective in order to avoid this.
  // Ideally, app should detect that OS is shutting down.
  mainWindow.on('blur', () => {
    saveWindowState(boundsInfoPath, mainWindow);
    mainWindow.blurWebView();
  });

  mainWindow.on('close', (event) => {
    if (global.willAppQuit) { // when [Ctrl|Cmd]+Q
      saveWindowState(boundsInfoPath, mainWindow);
    } else { // Minimize or hide the window for close button.
      event.preventDefault();
      function hideWindow(window) {
        window.blur(); // To move focus to the next top-level window in Windows
        window.hide();
      }
      switch (process.platform) {
      case 'win32':
        hideWindow(mainWindow);
        break;
      case 'linux':
        if (config.minimizeToTray) {
          hideWindow(mainWindow);
        } else {
          mainWindow.minimize();
        }
        break;
      case 'darwin':
        // need to leave fullscreen first, then hide the window
        if (mainWindow.isFullScreen()) {
          mainWindow.once('leave-full-screen', () => {
            app.hide();
          });
          mainWindow.setFullScreen(false);
        } else {
          app.hide();
        }
        break;
      default:
      }
    }
  });

  // Register keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Add Alt+Cmd+(Right|Left) as alternative to switch between servers
    if (process.platform === 'darwin') {
      if (input.alt && input.meta) {
        if (input.key === 'ArrowRight') {
          mainWindow.webContents.send('select-next-tab');
        }
        if (input.key === 'ArrowLeft') {
          mainWindow.webContents.send('select-previous-tab');
        }
      }
    }
  });

  return mainWindow;
}

export default createMainWindow;
