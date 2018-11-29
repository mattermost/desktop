// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';
import path from 'path';

import {app, BrowserWindow} from 'electron';

function saveWindowState(file, window) {
  const windowState = window.getBounds();
  windowState.maximized = window.isMaximized();
  windowState.fullscreen = window.isFullScreen();
  try {
    fs.writeFileSync(file, JSON.stringify(windowState));
  } catch (e) {
    // [Linux] error happens only when the window state is changed before the config dir is created.
    console.log(e);
  }
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
  } catch (e) {
    // Follow Electron's defaults, except for window dimensions which targets 1024x768 screen resolution.
    windowOptions = {width: defaultWindowWidth, height: defaultWindowHeight};
  }

  if (process.platform === 'linux') {
    windowOptions.icon = options.linuxAppIcon;
  }
  Object.assign(windowOptions, {
    title: app.getName(),
    fullscreenable: true,
    show: false,
    minWidth: minimumWindowWidth,
    minHeight: minimumWindowHeight,
  });

  const mainWindow = new BrowserWindow(windowOptions);
  mainWindow.deeplinkingUrl = options.deeplinkingUrl;

  const indexURL = global.isDev ? 'http://localhost:8080/browser/index.html' : `file://${app.getAppPath()}/browser/index.html`;
  mainWindow.loadURL(indexURL);

  // This section should be called after loadURL() #570
  if (options.hideOnStartup) {
    if (windowOptions.maximized) {
      mainWindow.maximize();
    }

    // on MacOS, the window is already hidden until 'ready-to-show'
    if (process.platform !== 'darwin') {
      mainWindow.minimize();
    }
  } else if (windowOptions.maximized) {
    mainWindow.maximize();
  }

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences) => {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.setZoomLevel(0);
    if (process.platform !== 'darwin') {
      mainWindow.show();
    } else if (options.hideOnStartup !== true) {
      mainWindow.show();
    }
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
        hideWindow(mainWindow);
        break;
      default:
      }
    }
  });

  mainWindow.on('sheet-end', () => {
    mainWindow.webContents.send('focus-on-webview');
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
