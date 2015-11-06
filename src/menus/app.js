'use strict';

var Menu = require('menu');

var createTemplate = function(mainWindow) {
  var app_name = require('app').getName()
  var first_menu_name = (process.platform === 'darwin') ? app_name : 'File';
  var template = [];
  template.push({
    label: first_menu_name,
    submenu: [{
      label: 'About ' + app_name,
      role: 'about'
    }, {
      label: 'Settings',
      click: function(item, focusedWindow) {
        mainWindow.loadUrl('file://' + __dirname + '/settings.html');
      }
    }, {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: function(item, focusedWindow) {
        require('app').quit();
      }
    }]
  });
  template.push({
    label: 'Edit',
    submenu: [{
      label: 'Undo',
      accelerator: 'CmdOrCtrl+Z',
      role: 'undo'
    }, {
      label: 'Redo',
      accelerator: 'Shift+CmdOrCtrl+Z',
      role: 'redo'
    }, {
      type: 'separator'
    }, {
      label: 'Cut',
      accelerator: 'CmdOrCtrl+X',
      role: 'cut'
    }, {
      label: 'Copy',
      accelerator: 'CmdOrCtrl+C',
      role: 'copy'
    }, {
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      role: 'paste'
    }, {
      label: 'Select All',
      accelerator: 'CmdOrCtrl+A',
      role: 'selectall'
    }, ]
  });
  template.push({
    label: 'View',
    submenu: [{
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: function(item, focusedWindow) {
        if (focusedWindow)
          focusedWindow.reload();
      }
    }, {
      label: 'Toggle Full Screen',
      accelerator: (function() {
        if (process.platform === 'darwin') {
          return 'Ctrl+Command+F';
        }
        else {
          return 'F11';
        }
      })(),
      click: function(item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        }
      }
    }, {
      label: 'Toggle Developer Tools',
      accelerator: (function() {
        if (process.platform === 'darwin') {
          return 'Alt+Command+I';
        }
        else {
          return 'Ctrl+Shift+I';
        }
      })(),
      click: function(item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      }
    }, ]
  });
  return template;
};

var createMenu = function(mainWindow) {
  return Menu.buildFromTemplate(createTemplate(mainWindow));
};

module.exports = {
  createMenu: createMenu
};
