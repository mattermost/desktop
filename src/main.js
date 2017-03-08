'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  dialog,
  systemPreferences,
  session
} = require('electron');
const isDev = require('electron-is-dev');
const installExtension = require('electron-devtools-installer');

const AutoLaunch = require('auto-launch');

process.on('uncaughtException', (error) => {
  console.error(error);
});

var willAppQuit = false;

if (process.platform === 'win32') {
  var cmd = process.argv[1];
  var appLauncher = new AutoLaunch({
    name: 'Mattermost',
    isHidden: true
  });
  if (cmd === '--squirrel-uninstall') {
    // If we're uninstalling, make sure we also delete our auto launch registry key
    appLauncher.isEnabled().then((enabled) => {
      if (enabled) {
        appLauncher.disable();
      }
    });
  } else if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') {
    // If we're updating and already have an registry entry for auto launch, make sure to update the path
    appLauncher.isEnabled().then((enabled) => {
      if (enabled) {
        return appLauncher.disable().then(() => {
          return appLauncher.enable();
        });
      }
      return true;
    });
  }
}

app.setAppUserModelId('com.squirrel.mattermost.Mattermost'); // Use explicit AppUserModelID
if (require('electron-squirrel-startup')) {
  willAppQuit = true;
}

const fs = require('fs');
const os = require('os');
const path = require('path');

var settings = require('./common/settings');
const osVersion = require('./common/osVersion');
var certificateStore = require('./main/certificateStore').load(path.resolve(app.getPath('userData'), 'certificate.json'));
const appMenu = require('./main/menus/app');
const trayMenu = require('./main/menus/tray');
const allowProtocolDialog = require('./main/allowProtocolDialog');

const assetsDir = path.resolve(app.getAppPath(), 'assets');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;

var argv = require('yargs').parse(process.argv.slice(1));

var hideOnStartup;
if (argv.hidden) {
  hideOnStartup = true;
}

if (argv['data-dir']) {
  app.setPath('userData', path.resolve(argv['data-dir']));
}

global.isDev = isDev && !argv.disableDevMode;

var config = {};
try {
  const configFile = app.getPath('userData') + '/config.json';
  config = settings.readFileSync(configFile);
  if (config.version !== settings.version || wasUpdated()) {
    clearAppCache();
    config = settings.upgrade(config, app.getVersion());
    settings.writeFileSync(configFile, config);
  }
} catch (e) {
  config = settings.loadDefault();
  console.log('Failed to read or upgrade config.json', e);
}

ipcMain.on('update-config', () => {
  const configFile = app.getPath('userData') + '/config.json';
  config = settings.readFileSync(configFile);
});

// Only for OS X
function switchMenuIconImages(icons, isDarkMode) {
  if (isDarkMode) {
    icons.normal = icons.clicked.normal;
    icons.unread = icons.clicked.unread;
    icons.mention = icons.clicked.mention;
  } else {
    icons.normal = icons.light.normal;
    icons.unread = icons.light.unread;
    icons.mention = icons.light.mention;
  }
}

var trayIcon = null;
const trayImages = (() => {
  switch (process.platform) {
  case 'win32':
    return {
      normal: nativeImage.createFromPath(path.resolve(assetsDir, 'windows/tray.ico')),
      unread: nativeImage.createFromPath(path.resolve(assetsDir, 'windows/tray_unread.ico')),
      mention: nativeImage.createFromPath(path.resolve(assetsDir, 'windows/tray_mention.ico'))
    };
  case 'darwin':
    {
      const icons = {
        light: {
          normal: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/MenuIcon.png')),
          unread: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/MenuIconUnread.png')),
          mention: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/MenuIconMention.png'))
        },
        clicked: {
          normal: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/ClickedMenuIcon.png')),
          unread: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/ClickedMenuIconUnread.png')),
          mention: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/ClickedMenuIconMention.png'))
        }
      };
      switchMenuIconImages(icons, systemPreferences.isDarkMode());
      return icons;
    }
  case 'linux':
    {
      const theme = config.trayIconTheme;
      try {
        return {
          normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', theme, 'MenuIconTemplate.png')),
          unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', theme, 'MenuIconUnreadTemplate.png')),
          mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', theme, 'MenuIconMentionTemplate.png'))
        };
      } catch (e) {
        //Fallback for invalid theme setting
        return {
          normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'light', 'MenuIconTemplate.png')),
          unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'light', 'MenuIconUnreadTemplate.png')),
          mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'light', 'MenuIconMentionTemplate.png'))
        };
      }
    }
  default:
    return {};
  }
})();

// If there is already an instance, activate the window in the existing instace and quit this one
if (app.makeSingleInstance((/*commandLine, workingDirectory*/) => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    } else {
      mainWindow.show();
    }
  }
})) {
  app.quit();
}

function shouldShowTrayIcon() {
  if (process.platform === 'win32') {
    return true;
  }
  if (['darwin', 'linux'].includes(process.platform) && config.showTrayIcon === true) {
    return true;
  }
  return false;
}

function wasUpdated() {
  return config.lastMattermostVersion !== app.getVersion();
}

function clearAppCache() {
  if (mainWindow) {
    console.log('Clear cache after update');
    mainWindow.webContents.session.clearCache(() => {
      //Restart after cache clear
      mainWindow.reload();
    });
  } else {
    //Wait for mainWindow
    setTimeout(clearAppCache, 100);
  }
}

function getValidWindowPosition(state) {
  // Screen cannot be required before app is ready
  const {screen} = require('electron');

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

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// For OSX, show hidden mainWindow when clicking dock icon.
app.on('activate', () => {
  mainWindow.show();
});

app.on('before-quit', () => {
  // Make sure tray icon gets removed if the user exits via CTRL-Q
  if (process.platform === 'win32') {
    trayIcon.destroy();
  }
  willAppQuit = true;
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (certificateStore.isTrusted(url, certificate)) {
    event.preventDefault();
    callback(true);
  } else {
    var detail = `URL: ${url}\nError: ${error}`;
    if (certificateStore.isExisting(url)) {
      detail = 'Certificate is different from previous one.\n\n' + detail;
    }

    dialog.showMessageBox(mainWindow, {
      title: 'Certificate error',
      message: `Do you trust certificate from "${certificate.issuerName}"?`,
      detail,
      type: 'warning',
      buttons: [
        'Yes',
        'No'
      ],
      cancelId: 1
    }, (response) => {
      if (response === 0) {
        certificateStore.add(url, certificate);
        certificateStore.save();
        webContents.loadURL(url);
      }
    });
    callback(false);
  }
});

const loginCallbackMap = new Map();

ipcMain.on('login-credentials', (event, request, user, password) => {
  const callback = loginCallbackMap.get(JSON.stringify(request));
  if (callback != null) {
    callback(user, password);
  }
});

app.on('login', (event, webContents, request, authInfo, callback) => {
  event.preventDefault();
  loginCallbackMap.set(JSON.stringify(request), callback);
  mainWindow.webContents.send('login-request', request, authInfo);
});

allowProtocolDialog.init(mainWindow);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', () => {
  if (willAppQuit) {
    return;
  }
  if (global.isDev) {
    installExtension.default(installExtension.REACT_DEVELOPER_TOOLS).
      then((name) => console.log(`Added Extension:  ${name}`)).
      catch((err) => console.log('An error occurred: ', err));
  }

  ipcMain.on('notified', () => {
    if (process.platform === 'win32' || process.platform === 'linux') {
      if (config.notifications.flashWindow === 2) {
        mainWindow.flashFrame(true);
      }
    }
  });

  ipcMain.on('update-title', (event, arg) => {
    mainWindow.setTitle(arg.title);
  });

  if (shouldShowTrayIcon()) {
    // set up tray icon
    trayIcon = new Tray(trayImages.normal);
    if (process.platform === 'darwin') {
      trayIcon.setPressedImage(trayImages.clicked.normal);
      systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
        switchMenuIconImages(trayImages, systemPreferences.isDarkMode());
        trayIcon.setImage(trayImages.normal);
      });
    }

    trayIcon.setToolTip(app.getName());
    trayIcon.on('click', () => {
      if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        } else {
          mainWindow.show();
        }
        mainWindow.focus();
        if (process.platform === 'darwin') {
          app.dock.show();
        }
      } else {
        mainWindow.focus();
      }
    });

    trayIcon.on('right-click', () => {
      trayIcon.popUpContextMenu();
    });
    trayIcon.on('balloon-click', () => {
      if (process.platform === 'win32' || process.platform === 'darwin') {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        } else {
          mainWindow.show();
        }
      }

      if (process.platform === 'darwin') {
        app.dock.show();
      }

      mainWindow.focus();
    });
    ipcMain.on('notified', (event, arg) => {
      if (process.platform === 'win32') {
        // On Windows 8.1 and Windows 8, a shortcut with a Application User Model ID must be installed to the Start screen.
        // In current version, use tray balloon for notification
        if (osVersion.isLowerThanOrEqualWindows8_1()) {
          trayIcon.displayBalloon({
            icon: path.resolve(assetsDir, 'appicon.png'),
            title: arg.title,
            content: arg.options.body
          });
        }
      }
    });

    // Set overlay icon from dataURL
    // Set trayicon to show "dot"
    ipcMain.on('update-unread', (event, arg) => {
      if (process.platform === 'win32') {
        const overlay = arg.overlayDataURL ? nativeImage.createFromDataURL(arg.overlayDataURL) : null;
        mainWindow.setOverlayIcon(overlay, arg.description);
      }

      if (arg.mentionCount > 0) {
        trayIcon.setImage(trayImages.mention);
        if (process.platform === 'darwin') {
          trayIcon.setPressedImage(trayImages.clicked.mention);
        }
        trayIcon.setToolTip(arg.mentionCount + ' unread mentions');
      } else if (arg.unreadCount > 0) {
        trayIcon.setImage(trayImages.unread);
        if (process.platform === 'darwin') {
          trayIcon.setPressedImage(trayImages.clicked.unread);
        }
        trayIcon.setToolTip(arg.unreadCount + ' unread channels');
      } else {
        trayIcon.setImage(trayImages.normal);
        if (process.platform === 'darwin') {
          trayIcon.setPressedImage(trayImages.clicked.normal);
        }
        trayIcon.setToolTip(app.getName());
      }
    });
  }

  // Create the browser window.
  var boundsInfoPath = path.resolve(app.getPath('userData'), 'bounds-info.json');
  var windowOptions;
  try {
    windowOptions = getValidWindowPosition(JSON.parse(fs.readFileSync(boundsInfoPath, 'utf-8')));
  } catch (e) {
    // Follow Electron's defaults, except for window dimensions which targets 1024x768 screen resolution.
    windowOptions = {width: 1000, height: 700};
  }
  if (process.platform === 'linux') {
    windowOptions.icon = path.resolve(assetsDir, 'appicon.png');
  }
  Object.assign(windowOptions, {
    title: app.getName(),
    fullscreenable: true,
    show: false,
    minWidth: 400,
    minHeight: 240
  });
  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.once('ready-to-show', () => {
    if (process.platform !== 'darwin') {
      mainWindow.show();
    } else if (hideOnStartup !== true) {
      mainWindow.show();
    }
  });

  if (process.platform === 'darwin') {
    session.defaultSession.on('will-download', (event, item) => {
      var filename = item.getFilename();
      var savePath = dialog.showSaveDialog({
        title: filename,
        defaultPath: os.homedir() + '/Downloads/' + filename
      });

      if (savePath) {
        item.setSavePath(savePath);
      } else {
        item.cancel();
      }
    });
  }

  mainWindow.webContents.on('crashed', () => {
    console.log('The application has crashed.');
  });

  mainWindow.on('unresponsive', () => {
    console.log('The application has become unresponsive.');
  });

  if (hideOnStartup) {
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

  // and load the index.html of the app.
  const indexURL = global.isDev ? 'http://localhost:8080/browser/index.html' : `file://${app.getAppPath()}/browser/index.html`;
  mainWindow.loadURL(indexURL);

  // Set application menu
  ipcMain.on('update-menu', (event, configData) => {
    var aMenu = appMenu.createMenu(mainWindow, configData, global.isDev);
    Menu.setApplicationMenu(aMenu);

    // set up context menu for tray icon
    if (shouldShowTrayIcon()) {
      const tMenu = trayMenu.createMenu(mainWindow, configData, global.isDev);
      trayIcon.setContextMenu(tMenu);
      if (process.platform === 'darwin' || process.platform === 'linux') {
        // store the information, if the tray was initialized, for checking in the settings, if the application
        // was restarted after setting "Show icon on menu bar"
        if (trayIcon) {
          mainWindow.trayWasVisible = true;
        } else {
          mainWindow.trayWasVisible = false;
        }
      }
    }
  });
  ipcMain.emit('update-menu', true, config);

  // Open the DevTools.
  // mainWindow.openDevTools();

  function saveWindowState(file, window) {
    var windowState = window.getBounds();
    windowState.maximized = window.isMaximized();
    windowState.fullscreen = window.isFullScreen();
    try {
      fs.writeFileSync(boundsInfoPath, JSON.stringify(windowState));
    } catch (e) {
      // [Linux] error happens only when the window state is changed before the config dir is creatied.
    }
  }

  mainWindow.on('close', (event) => {
    if (willAppQuit) { // when [Ctrl|Cmd]+Q
      saveWindowState(boundsInfoPath, mainWindow);
    } else { // Minimize or hide the window for close button.
      event.preventDefault();
      function hideWindow(window) {
        window.hide();
        window.blur(); // To move focus to the next top-level window in Windows
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

  // App should save bounds when a window is closed.
  // However, 'close' is not fired in some situations(shutdown, ctrl+c)
  // because main process is killed in such situations.
  // 'blur' event was effective in order to avoid this.
  // Ideally, app should detect that OS is shutting down.
  mainWindow.on('blur', () => {
    saveWindowState(boundsInfoPath, mainWindow);
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});
