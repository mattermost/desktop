const {app, BrowserWindow} = require('electron');
const fs = require('fs');
const path = require('path');

function saveWindowState(file, window) {
  var windowState = window.getBounds();
  windowState.maximized = window.isMaximized();
  windowState.fullscreen = window.isFullScreen();
  try {
    fs.writeFileSync(file, JSON.stringify(windowState));
  } catch (e) {
    // [Linux] error happens only when the window state is changed before the config dir is created.
    console.log(e);
  }
}

function getValidWindowPosition(state) {
  // Screen cannot be required before app is ready
  const {screen} = require('electron'); // eslint-disable-line global-require

  // Check if the previous position is out of the viewable area
  // (e.g. because the screen has been plugged off)
  const displays = screen.getAllDisplays();
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (let i = 0; i < displays.length; i++) {
    const display = displays[i];
    maxX = Math.max(maxX, display.bounds.x + display.bounds.width);
    maxY = Math.max(maxY, display.bounds.y + display.bounds.height);
    minX = Math.min(minX, display.bounds.x);
    minY = Math.min(minY, display.bounds.y);
  }

  if (state.x > maxX || state.y > maxY || state.x < minX || state.y < minY) {
    Reflect.deleteProperty(state, 'x');
    Reflect.deleteProperty(state, 'y');
    Reflect.deleteProperty(state, 'width');
    Reflect.deleteProperty(state, 'height');
  }

  return state;
}

function createMainWindow(config, options) {
  const defaultWindowWidth = 1000;
  const defaultWindowHeight = 700;
  const minimumWindowWidth = 400;
  const minimumWindowHeight = 240;

  // Create the browser window.
  const boundsInfoPath = path.join(app.getPath('userData'), 'bounds-info.json');
  var windowOptions;
  try {
    windowOptions = getValidWindowPosition(JSON.parse(fs.readFileSync(boundsInfoPath, 'utf-8')));
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
    minHeight: minimumWindowHeight
  });

  const mainWindow = new BrowserWindow(windowOptions);
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
  });

  const indexURL = global.isDev ? 'http://localhost:8080/browser/index.html' : `file://${app.getAppPath()}/browser/index.html`;
  mainWindow.loadURL(indexURL);

  mainWindow.once('ready-to-show', () => {
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

  return mainWindow;
}

module.exports = {createMainWindow};
