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
    role: 'hide'
  }, {
    role: 'hideothers'
  }, {
    role: 'unhide'
  }, separatorItem, {
    role: 'quit'
  }] : [{
    label: 'Settings...',
    accelerator: 'CmdOrCtrl+,',
    click: function(item, focusedWindow) {
      mainWindow.loadURL('file://' + __dirname + '/browser/settings.html');
    }
  }, separatorItem, {
    role: 'quit',
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
      role: 'undo'
    }, {
      role: 'redo'
    }, separatorItem, {
      role: 'cut'
    }, {
      role: 'copy'
    }, {
      role: 'paste'
    }, {
      role: 'selectall'
    }, separatorItem, {
      label: 'Search in Team',
      accelerator: 'CmdOrCtrl+S',
      click: (item, focusedWindow) => {
        if (focusedWindow) {
          focusedWindow.webContents.send('activate-search-box');
        }
      }
    }]
  });
  template.push({
    label: '&View',
    submenu: [{
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: function(item, focusedWindow) {
        if (focusedWindow) {
          if (focusedWindow === mainWindow) {
            mainWindow.webContents.send('reload-tab');
          }
          else {
            focusedWindow.reload();
          }
        }
      }
    }, {
      label: 'Clear Cache and Reload',
      accelerator: 'Shift+CmdOrCtrl+R',
      click: function(item, focusedWindow) {
        if (focusedWindow) {
          if (focusedWindow === mainWindow) {
            mainWindow.webContents.send('clear-cache-and-reload-tab');
          }
          else {
            focusedWindow.webContents.session.clearCache(function() {
              focusedWindow.reload();
            });
          }
        }
      }
    }, {
      role: 'togglefullscreen'
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
      label: 'Zoom In (hidden)',
      accelerator: 'CmdOrCtrl+=',
      visible: false,
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
  template.push({
    label: '&History',
    submenu: [{
      label: 'Back',
      accelerator: process.platform === 'darwin' ? 'Cmd+[' : 'Alt+Left',
      click: (item, focusedWindow) => {
        if (focusedWindow === mainWindow) {
          mainWindow.webContents.send('go-back');
        }
        else {
          if (focusedWindow.webContents.canGoBack()) {
            focusedWindow.goBack();
          }
        }
      }
    }, {
      label: 'Forward',
      accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
      click: (item, focusedWindow) => {
        if (focusedWindow === mainWindow) {
          mainWindow.webContents.send('go-forward');
        }
        else {
          if (focusedWindow.webContents.canGoForward()) {
            focusedWindow.goForward();
          }
        }
      }
    }]
  });


  const window_menu = {
    label: '&Window',
    submenu: [{
      role: 'minimize'
    }, {
      role: 'close'
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
  };
  template.push(window_menu);

  template.push({
    label: '&Help',
    submenu: [{
      label: `Learn More...`,
      click: function() {
        electron.shell.openExternal('https://docs.mattermost.com/help/apps/desktop-guide.html');
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
