'use strict';

const electron = require('electron');
const Menu = electron.Menu;

var createTemplate = function(mainWindow, config) {
  const separatorItem = {
    type: 'separator'
  };

  var app_name = electron.app.getName();
  var first_menu_name = (process.platform === 'darwin') ? app_name : 'File';
  var template = [];

  const platformAppMenu = process.platform === 'darwin' ? [{
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
  }] : [];

  template.push({
    label: '&' + first_menu_name,
    submenu: [{
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
      label: (process.platform === 'darwin') ? 'Preferences...' : 'Settings',
      accelerator: 'CmdOrCtrl+,',
      click: function(item, focusedWindow) {
        mainWindow.loadURL('file://' + __dirname + '/browser/settings.html');
      }
    }, {
      type: 'separator'
    }, ...platformAppMenu, {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: function(item, focusedWindow) {
        electron.app.quit();
      }
    }]
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
    }, separatorItem, {
      label: 'Actual size',
      accelerator: 'CmdOrCtrl+0',
      click: () => {
        mainWindow.webContents.send('zoom-reset');
      }
    }, {
      label: 'Zoom In',
      accelerator: 'CmdOrCtrl+Plus',
      click: () => {
        mainWindow.webContents.send('zoom-in', 1);
      }
    }, {
      label: 'Zoom Out',
      accelerator: 'CmdOrCtrl+-',
      click: () => {
        mainWindow.webContents.send('zoom-in', -1);
      }
    }]
  });

  const window_menu = {
    label: '&Window',
    submenu: [{
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      click: function(item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.minimize();
        }
      }
    }, {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      click: function(item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.close();
        }
      }
    }, {
      type: 'separator'
    }, ...config.teams.slice(0, 9).map((team, i) => {
      return {
        label: team.name,
        accelerator: `CmdOrCtrl+${i + 1}`,
        click: (item, focusedWindow) => {
          mainWindow.show(); // for OS X
          mainWindow.webContents.send('switch-tab', i);
        }
      };
    })]
  }

  if (config.teams.length > 1) {
    window_menu.submenu = window_menu.submenu.concat([{
      type: 'separator'
    }, {
      label: 'Select Next Team',
      accelerator: (process.platform === 'darwin') ? 'Alt+Cmd+Right' : 'CmdOrCtrl+Tab',
      click: () => {
        mainWindow.webContents.send('select-next-tab');
      }
    }, {
      label: 'Select Previous Team',
      accelerator: (process.platform === 'darwin') ? 'Alt+Cmd+Left' : 'CmdOrCtrl+Shift+Tab',
      click: () => {
        mainWindow.webContents.send('select-previous-tab');
      }
    }]);
  }
  template.push(window_menu);

  return template;
};

var createMenu = function(mainWindow, config) {
  return Menu.buildFromTemplate(createTemplate(mainWindow, config));
};

module.exports = {
  createMenu: createMenu
};
