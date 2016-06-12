'use strict';

const electron = require('electron');
const app = electron.app; // Module to control application life.

if (require('electron-squirrel-startup')) app.quit();

const BrowserWindow = electron.BrowserWindow; // Module to create native browser window.
const Menu = electron.Menu;
const Tray = electron.Tray;
const ipc = electron.ipcMain;
const nativeImage = electron.nativeImage;
const fs = require('fs');
const path = require('path');

var settings = require('./common/settings');
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
      return {
        normal: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/MenuIcon.png')),
        unread: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/MenuIconUnread.png')),
        mention: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/MenuIconMention.png')),
        clicked: {
          normal: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/ClickedMenuIcon.png')),
          unread: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/ClickedMenuIconUnread.png')),
          mention: nativeImage.createFromPath(path.resolve(__dirname, 'resources/osx/ClickedMenuIconMention.png'))
        }
      };
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

    electron.dialog.showMessageBox(mainWindow, {
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

ipc.on('login-credentials', function(event, request, user, password) {
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
    trayIcon.setPressedImage(trayImages.clicked.normal);
    trayIcon.setToolTip(app.getName());
    trayIcon.on('click', function() {
      mainWindow.focus();
    });
    trayIcon.on('right-click', () => {
      trayIcon.popUpContextMenu();
    });
    trayIcon.on('balloon-click', function() {
      mainWindow.focus();
    });
    ipc.on('notified', function(event, arg) {
      trayIcon.displayBalloon({
        icon: path.resolve(__dirname, 'resources/appicon.png'),
        title: arg.title,
        content: arg.options.body
      });
    });

    // Set overlay icon from dataURL
    // Set trayicon to show "dot"
    ipc.on('update-unread', function(event, arg) {
      if (process.platform === 'win32') {
        const overlay = arg.overlayDataURL ? electron.nativeImage.createFromDataURL(arg.overlayDataURL) : null;
        mainWindow.setOverlayIcon(overlay, arg.description);
      }

      if (arg.mentionCount > 0) {
        trayIcon.setImage(trayImages.mention);
        trayIcon.setPressedImage(trayImages.clicked.mention);
        trayIcon.setToolTip(arg.mentionCount + ' unread mentions');
      }
      else if (arg.unreadCount > 0) {
        trayIcon.setImage(trayImages.unread);
        trayIcon.setPressedImage(trayImages.clicked.unread);
        trayIcon.setToolTip(arg.unreadCount + ' unread channels');
      }
      else {
        trayIcon.setImage(trayImages.normal);
        trayIcon.setPressedImage(trayImages.clicked.normal);
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
  if (process.platform === 'linux') {
    window_options.icon = path.resolve(__dirname, 'resources/appicon.png');
  }
  window_options.title = app.getName();
  mainWindow = new BrowserWindow(window_options);
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
  ipc.on('update-menu', (event, config) => {
    var app_menu = appMenu.createMenu(mainWindow, config);
    Menu.setApplicationMenu(app_menu);
  });
  ipc.emit('update-menu', true, config);

  // set up context menu for tray icon
  if (shouldShowTrayIcon()) {
    const tray_menu = require('./main/menus/tray').createDefault(mainWindow);
    trayIcon.setContextMenu(tray_menu);
  }

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
        case 'linux':
          mainWindow.minimize();
          break;
        case 'darwin':
          mainWindow.hide();
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
