"use strict";

var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');  // Module to create native browser window.
var Menu = require('menu');
var appMenu = require('./app-menu');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;
var willAppQuit = false;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// For win32, auto-hide menu bar.
app.on('browser-window-created', function(event, window){
  if(process.platform === 'win32'){
    window.setAutoHideMenuBar(true);
    window.setMenuBarVisibility(false);
  }
});

// For OSX, show hidden mainWindow when clicking dock icon.
app.on('activate', function(event){
  mainWindow.show();
});

app.on('before-quit', function(){
  willAppQuit = true;
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600});

  // and load the index.html of the app.
  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  // Open the DevTools.
  // mainWindow.openDevTools();

  mainWindow.on('close', function(event){
    // Minimize or hide the window for close button.
    if(!willAppQuit){ // avoid [Ctrl|Cmd]+Q
      event.preventDefault();
      switch (process.platform) {
        case 'win32':
          mainWindow.minimize();
          break;
        case 'darwin':
          mainWindow.hide();
          break;
        default:
      }
    }
  });

  var menu = appMenu.createMenu(mainWindow);
  Menu.setApplicationMenu(menu);

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // Deny drag&drop navigation in mainWindow.
  // Drag&drop is allowed in webview of index.html.
  mainWindow.webContents.on('will-navigate', function(event, url){
    event.preventDefault();
  });
});
