'use strict';

const electron = require('electron');
const app = electron.app; // Module to control application life.
const BrowserWindow = electron.BrowserWindow; // Module to create native browser window.
const Menu = electron.Menu;
const Tray = electron.Tray;
const ipc = electron.ipcMain;
const fs = require('fs');

var settings = require('./common/settings');
var appMenu = require('./menus/app');

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
  console.log('Failed to read or upgrade config.json');
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;
var trayIcon = null;
var willAppQuit = false;

// For toast notification on windows
app.setAppUserModelId('yuya-oc.electron-mattermost');

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
  if (process.platform === 'win32') {
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  // set up tray icon to show balloon
  if (process.platform === 'win32') {
    trayIcon = new Tray(__dirname + '/resources/tray.png');
    trayIcon.setToolTip(app.getName());
    var tray_menu = require('./menus/tray').createDefault();
    trayIcon.setContextMenu(tray_menu);
    trayIcon.on('click', function() {
      mainWindow.focus();
    });
    trayIcon.on('balloon-click', function() {
      mainWindow.focus();
    });
    ipc.on('notified', function(event, arg) {
      trayIcon.displayBalloon({
        icon: __dirname + '/resources/appicon.png',
        title: arg.title,
        content: arg.options.body
      });
    });
  }

  // Create the browser window.
  var bounds_info_path = app.getPath("userData") + "/bounds-info.json";
  var window_options;
  try {
    window_options = require(bounds_info_path);
  }
  catch (e) {
    // follow Electron's defaults
    window_options = {};
  }
  window_options.icon = __dirname + '/resources/appicon.png';
  mainWindow = new BrowserWindow(window_options);
  if (window_options.maximized) {
    mainWindow.maximize();
  }

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/browser/index.html');

  // Open the DevTools.
  // mainWindow.openDevTools();

  var saveWindowState = function(file, window) {
    var window_state = window.getBounds();
    window_state.maximized = window.isMaximized();
    window_state.fullscreen = window.isFullScreen();
    fs.writeFileSync(bounds_info_path, JSON.stringify(window_state));
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

  var app_menu = appMenu.createMenu(mainWindow);
  Menu.setApplicationMenu(app_menu);

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
