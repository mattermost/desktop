'use strict';

const electron = require('electron');
const app = electron.app; // Module to control application life.
const BrowserWindow = electron.BrowserWindow; // Module to create native browser window.
const Menu = electron.Menu;
const Tray = electron.Tray;
const ipc = electron.ipcMain;
var appMenu = require('./menus/app');

var client = null;
if (process.argv.indexOf('--livereload') > 0) {
  client = require('electron-connect').client.create();
  client.on('stop', function() {
    app.quit();
  });
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
    window.setAutoHideMenuBar(true);
    window.setMenuBarVisibility(false);
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
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: __dirname + '/resources/appicon.png'
  });

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  // Open the DevTools.
  // mainWindow.openDevTools();

  mainWindow.on('close', function(event) {
    // Minimize or hide the window for close button.
    if (!willAppQuit) { // avoid [Ctrl|Cmd]+Q
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
