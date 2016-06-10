'use strict';

const electron = require('electron');
const Menu = electron.Menu;
const autoUpdater = require('./../../auto-updater');

var createTemplate = function(mainWindow) {
  var app_name = electron.app.getName();
  var first_menu_name = (process.platform === 'darwin') ? app_name : 'File';
  var template = [];

  const platformAppMenu = process.platform === 'darwin' ? [{
    label: 'About ' + app_name,
    role: 'about',
    click: function(item, focusedWindow) {
      electron.dialog.showMessageBox(mainWindow, {
        buttons: ["OK"],
        message: `${app_name} Desktop ${electron.app.getVersion()}`
      });
    }
  }, {
    type: 'separator'
  }, {
    label: 'Preferences...',
    accelerator: 'CmdOrCtrl+,',
    click: function(item, focusedWindow) {
      mainWindow.loadURL('file://' + __dirname + '/browser/settings.html');
    }
  }, {
    type: 'separator'
  }, {
    label: 'Hide ' + app_name,
    accelerator: 'Command+H',
    selector: 'hide:'
  }, {
    label: 'Hide Others',
    accelerator: 'Command+Shift+H',
    selector: 'hideOtherApplications:'
  }, {
    label: 'Show All',
    selector: 'unhideAllApplications:'
  }, {
    type: 'separator'
  }, {
    label: 'Quit ' + app_name,
    accelerator: 'CmdOrCtrl+Q',
    click: function(item, focusedWindow) {
      electron.app.quit();
    }
  }] : [{
    label: 'Settings',
    accelerator: 'CmdOrCtrl+,',
    click: function(item, focusedWindow) {
      mainWindow.loadURL('file://' + __dirname + '/browser/settings.html');
    }
  }, {
    type: 'separator'
  }, {
    label: 'Quit',
    accelerator: 'CmdOrCtrl+Q',
    click: function(item, focusedWindow) {
      electron.app.quit();
    }
  }];

  template.push({
    label: '&' + first_menu_name,
    submenu: [
      ...platformAppMenu
    ]
  });
  template.push({
    label: '&Edit',
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
    label: '&View',
    submenu: [{
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: function(item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.reload();
        }
      }
    }, {
      label: 'Clear Cache and Reload',
      accelerator: 'Shift+CmdOrCtrl+R',
      click: function(item, focusedWindow) {
        // TODO: should reload the selected tab only
        if (focusedWindow) {
          focusedWindow.webContents.session.clearCache(function() {
            focusedWindow.reload();
          });
        }
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
      type: 'separator'
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
  template.push({
    label: '&Help',
    submenu: [{
      label: `Version ${electron.app.getVersion()}`,
      enabled: false
    }, {
      label: 'Checking for Update',
      enabled: false,
      key: 'checkingForUpdate'
    }, {
      label: 'Check for Update',
      visible: false,
      key: 'checkForUpdate',
      click: function() {
        autoUpdater.checkForUpdates()
      }
    }, {
      label: 'Restart and Install Update',
      enabled: true,
      visible: false,
      key: 'restartToUpdate',
      click: function() {
        autoUpdater.quitAndInstall()
      }
    }]
  });
  return template;
};

var createMenu = function(mainWindow) {
  return Menu.buildFromTemplate(createTemplate(mainWindow));
};

module.exports = {
  createMenu: createMenu
};
