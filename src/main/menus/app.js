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
    label: 'About ' + app_name,
    role: 'about',
    click: function(item, focusedWindow) {
      electron.dialog.showMessageBox(mainWindow, {
        buttons: ["OK"],
        message: `${app_name} Desktop ${electron.app.getVersion()}`
      });
    }
  }, separatorItem, {
    label: 'Preferences...',
    accelerator: 'CmdOrCtrl+,',
    click: function(item, focusedWindow) {
      mainWindow.loadURL('file://' + __dirname + '/browser/settings.html');
    }
  }, separatorItem, {
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
  }, separatorItem, {
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
  }, separatorItem, {
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
    }, separatorItem, {
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
    }, separatorItem, {
      label: 'Actual Size',
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
    }, separatorItem, {
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
    }, separatorItem, ...config.teams.slice(0, 9).map((team, i) => {
      return {
        label: team.name,
        accelerator: `CmdOrCtrl+${i + 1}`,
        click: (item, focusedWindow) => {
          mainWindow.show(); // for OS X
          mainWindow.webContents.send('switch-tab', i);
        }
      };
    }), separatorItem, {
      label: 'Select Next Team',
      accelerator: (process.platform === 'darwin') ? 'Alt+Cmd+Right' : 'CmdOrCtrl+Tab',
      click: () => {
        mainWindow.webContents.send('select-next-tab');
      },
      enabled: (config.teams.length > 1)
    }, {
      label: 'Select Previous Team',
      accelerator: (process.platform === 'darwin') ? 'Alt+Cmd+Left' : 'CmdOrCtrl+Shift+Tab',
      click: () => {
        mainWindow.webContents.send('select-previous-tab');
      },
      enabled: (config.teams.length > 1)
    }]
  }
  template.push(window_menu);

  template.push({
    label: '&Help',
    submenu: [{
      label: `${app_name} Docs`,
      click: function() {
        electron.shell.openExternal('http://docs.mattermost.com')
      }
    }, {
      type: 'separator'
    }, {
      label: `Version ${electron.app.getVersion()}`,
      enabled: false
    }, ]
  });
  return template;
};

var createMenu = function(mainWindow, config) {
  return Menu.buildFromTemplate(createTemplate(mainWindow, config));
};

module.exports = {
  createMenu: createMenu
};
