'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  dialog,
  systemPreferences
} = require('electron');

process.on('uncaughtException', (error) => {
  console.error(error);
});

if (process.platform === 'win32') {
  var cmd = process.argv[1];
  if (cmd === '--squirrel-uninstall') {
    var AutoLaunch = require('auto-launch');
    var appLauncher = new AutoLaunch({
      name: 'Mattermost'
    });
    appLauncher.isEnabled().then(function(enabled) {
      if (enabled)
        appLauncher.disable();
    });
  }
}

require('electron-squirrel-startup');

const fs = require('fs');
const path = require('path');

var settings = require('./common/settings');
const osVersion = require('./common/osVersion');
var certificateStore = require('./main/certificateStore').load(path.resolve(app.getPath('userData'), 'certificate.json'));
var appMenu = require('./main/menus/app');
const allowProtocolDialog = require('./main/allowProtocolDialog');

var argv = require('yargs').argv;

var client = null;
if (argv.livereload) {
  client = require('electron-connect').client.create();
  client.on('reload', function() {
    mainWindow.reload();
  });
}

if (argv['config-file']) {
  global['config-file'] = argv['config-file'];
}
else {
  global['config-file'] = app.getPath('userData') + '/config.json'
}

var config = {};
try {
  var configFile = global['config-file'];
  config = settings.readFileSync(configFile);
  if (config.version != settings.version) {
    config = settings.upgrade(config);
    settings.writeFileSync(configFile, config);
  }
}
catch (e) {
  config = settings.loadDefault();
  console.log('Failed to read or upgrade config.json');
}
ipcMain.on('update-config', () => {
  config = settings.readFileSync(configFile);
});

// Only for OS X
const switchMenuIconImages = function(icons, isDarkMode) {
  if (isDarkMode) {
    icons.normal = icons.clicked.normal;
    icons.unread = icons.clicked.unread;
    icons.mention = icons.clicked.mention;
  }
  else {
    icons.normal = icons.light.normal;
    icons.unread = icons.light.unread;
    icons.mention = icons.light.mention;
  }
};

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;
var trayIcon = null;
const trayImages = function() {
  switch (process.platform) {
    case 'win32':
      return {
        normal: nativeImage.createFromPath(path.resolve(__dirname, 'resources/windows/tray.ico')),
        unread: nativeImage.createFromPath(path.resolve(__dirname, 'resources/windows/tray_unread.ico')),
        mention: nativeImage.createFromPath(path.resolve(__dirname, 'resources/windows/tray_mention.ico'))
      };
    case 'darwin':
      const icons = {
        light: {
          normal: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/MenuIcon.png')),
          unread: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/MenuIconUnread.png')),
          mention: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/MenuIconMention.png'))
        },
        clicked: {
          normal: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/ClickedMenuIcon.png')),
          unread: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/ClickedMenuIconUnread.png')),
          mention: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/ClickedMenuIconMention.png'))
        }
      };
      switchMenuIconImages(icons, systemPreferences.isDarkMode());
      return icons;
    case 'linux':
      var resourcesDir = 'resources/linux/' + (config.trayIconTheme || 'light') + '/';
      return {
        normal: nativeImage.createFromPath(path.resolve(__dirname, resourcesDir + 'MenuIconTemplate.png')),
        unread: nativeImage.createFromPath(path.resolve(__dirname, resourcesDir + 'MenuIconUnreadTemplate.png')),
        mention: nativeImage.createFromPath(path.resolve(__dirname, resourcesDir + 'MenuIconMentionTemplate.png'))
      };
    default:
      return {};
  }
}();
var willAppQuit = false;

function shouldShowTrayIcon() {
  if (process.platform === 'win32') {
    return true;
  }
  if (['darwin', 'linux'].includes(process.platform) && config.showTrayIcon === true) {
    return true;
  }
  return false;
}

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// For win32, auto-hide menu bar.
app.on('browser-window-created', function(event, window) {
  if (process.platform === 'win32' || process.platform === 'linux') {
    if (config.hideMenuBar) {
      window.setAutoHideMenuBar(true);
      window.setMenuBarVisibility(false);
    }
  }
});

// For OSX, show hidden mainWindow when clicking dock icon.
app.on('activate', function(event) {
  mainWindow.show();
});

app.on('before-quit', function() {
  willAppQuit = true;
});

app.on('certificate-error', function(event, webContents, url, error, certificate, callback) {
  if (certificateStore.isTrusted(url, certificate)) {
    event.preventDefault();
    callback(true);
  }
  else {
    var detail = `URL: ${url}\nError: ${error}`;
    if (certificateStore.isExisting(url)) {
      detail = `Certificate is different from previous one.\n\n` + detail;
    }

    dialog.showMessageBox(mainWindow, {
      title: 'Certificate error',
      message: `Do you trust certificate from "${certificate.issuerName}"?`,
      detail: detail,
      type: 'warning',
      buttons: [
        'Yes',
        'No'
      ],
      cancelId: 1
    }, function(response) {
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

ipcMain.on('login-credentials', function(event, request, user, password) {
  const callback = loginCallbackMap.get(JSON.stringify(request));
  if (callback != null) {
    callback(user, password);
  }
})

app.on('login', function(event, webContents, request, authInfo, callback) {
  event.preventDefault();
  loginCallbackMap.set(JSON.stringify(request), callback);
  mainWindow.webContents.send('login-request', request, authInfo);
});

allowProtocolDialog.init(mainWindow);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  if (shouldShowTrayIcon()) {
    // set up tray icon
    trayIcon = new Tray(trayImages.normal);
    if (process.platform === 'darwin') {
      trayIcon.setPressedImage(trayImages.clicked.normal);
      systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', (event, userInfo) => {
        switchMenuIconImages(trayImages, systemPreferences.isDarkMode());
        trayIcon.setImage(trayImages.normal);
      });
    }

    trayIcon.setToolTip(app.getName());
    trayIcon.on('click', function() {
      if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
        mainWindow.show();
        mainWindow.focus();
        if (process.platform === 'darwin') {
          app.dock.show();
        }
      }
      else if ((process.platform === 'win32') && config.toggleWindowOnTrayIconClick) {
        mainWindow.minimize();
      }
      else {
        mainWindow.focus();
      }
    });

    trayIcon.on('right-click', () => {
      trayIcon.popUpContextMenu();
    });
    trayIcon.on('balloon-click', function() {
      if (process.platform === 'win32' || process.platform === 'darwin') {
        mainWindow.show();
      }

      if (process.platform === 'darwin') {
        app.dock.show();
      }

      mainWindow.focus();
    });
    ipcMain.on('notified', function(event, arg) {
      if (process.platform === 'win32') {
        if (config.notifications.flashWindow === 2) {
          mainWindow.flashFrame(true);
        }
        // On Windows 8.1 and Windows 8, a shortcut with a Application User Model ID must be installed to the Start screen.
        // In current version, use tray balloon for notification
        if (osVersion.isLowerThanOrEqualWindows8_1()) {
          trayIcon.displayBalloon({
            icon: path.resolve(__dirname, 'resources/appicon.png'),
            title: arg.title,
            content: arg.options.body
          });
        }
      }
    });

    // Set overlay icon from dataURL
    // Set trayicon to show "dot"
    ipcMain.on('update-unread', function(event, arg) {
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
      }
      else if (arg.unreadCount > 0) {
        trayIcon.setImage(trayImages.unread);
        if (process.platform === 'darwin') {
          trayIcon.setPressedImage(trayImages.clicked.unread);
        }
        trayIcon.setToolTip(arg.unreadCount + ' unread channels');
      }
      else {
        trayIcon.setImage(trayImages.normal);
        if (process.platform === 'darwin') {
          trayIcon.setPressedImage(trayImages.clicked.normal);
        }
        trayIcon.setToolTip(app.getName());
      }
    });
  }

  // Create the browser window.
  var bounds_info_path = path.resolve(app.getPath("userData"), "bounds-info.json");
  var window_options;
  try {
    window_options = JSON.parse(fs.readFileSync(bounds_info_path, 'utf-8'));
  }
  catch (e) {
    // follow Electron's defaults
    window_options = {};
  }
  if (process.platform === 'win32' || process.platform === 'linux') {
    // On HiDPI(125%) Windows environment, the taskbar icon is pixelated. So this line is necessary. See #192.
    // As the side effect, #98 reoccurs.
    window_options.icon = path.resolve(__dirname, 'resources/appicon.png');
  }
  window_options.title = app.getName();
  mainWindow = new BrowserWindow(window_options);

  mainWindow.webContents.on('crashed', () => {
    console.log('The application has crashed.');
  });

  mainWindow.on('unresponsive', () => {
    console.log('The application has become unresponsive.')
  });

  mainWindow.setFullScreenable(true); // fullscreenable option has no effect.
  if (window_options.maximized) {
    mainWindow.maximize();
  }
  if (window_options.fullscreen) {
    mainWindow.setFullScreen(true);
  }

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/browser/index.html');

  // Set application menu
  ipcMain.on('update-menu', (event, config) => {
    var app_menu = appMenu.createMenu(mainWindow, config);
    Menu.setApplicationMenu(app_menu);
    // set up context menu for tray icon
    if (shouldShowTrayIcon()) {
      const tray_menu = require('./main/menus/tray').createMenu(mainWindow, config);
      trayIcon.setContextMenu(tray_menu);
      if (process.platform === 'darwin') {
        // store the information, if the tray was initialized, for checking in the settings, if the application
        // was restarted after setting "Show icon on menu bar"
        if (trayIcon)
          mainWindow.trayWasVisible = true;
        else
          mainWindow.trayWasVisible = false;
      }
    }
  });
  ipcMain.emit('update-menu', true, config);

  // Open the DevTools.
  // mainWindow.openDevTools();

  var saveWindowState = function(file, window) {
    var window_state = window.getBounds();
    window_state.maximized = window.isMaximized();
    window_state.fullscreen = window.isFullScreen();
    try {
      fs.writeFileSync(bounds_info_path, JSON.stringify(window_state));
    }
    catch (e) {
      // [Linux] error happens only when the window state is changed before the config dir is creatied.
    }
  };

  mainWindow.on('close', function(event) {
    if (willAppQuit) { // when [Ctrl|Cmd]+Q
      saveWindowState(bounds_info_path, mainWindow);
    }
    else { // Minimize or hide the window for close button.
      event.preventDefault();
      switch (process.platform) {
        case 'win32':
          mainWindow.hide();
          break;
        case 'linux':
          if (config.minimizeToTray) {
            mainWindow.hide();
          }
          else {
            mainWindow.minimize();
          }
          break;
        case 'darwin':
          mainWindow.hide();
          if (config.minimizeToTray) {
            app.dock.hide();
          }
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
  mainWindow.on('blur', function() {
    saveWindowState(bounds_info_path, mainWindow);
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // Deny drag&drop navigation in mainWindow.
  // Drag&drop is allowed in webview of index.html.
  mainWindow.webContents.on('will-navigate', function(event, url) {
    var dirname = __dirname;
    if (process.platform === 'win32') {
      dirname = '/' + dirname.replace(/\\/g, '/');
    }

    var index = url.indexOf('file://' + dirname);
    if (index !== 0) {
      event.preventDefault();
    }
  });
});
