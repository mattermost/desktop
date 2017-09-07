'use strict';

const electron = require('electron');

const Menu = electron.Menu;

function createTemplate(mainWindow, config, isDev) {
  const settingsURL = isDev ? 'http://localhost:8080/browser/settings.html' : `file://${electron.app.getAppPath()}/browser/settings.html`;

  const separatorItem = {
    type: 'separator'
  };

  var appName = electron.app.getName();
  var firstMenuName = (process.platform === 'darwin') ? appName : 'File';
  var template = [];

  const platformAppMenu = process.platform === 'darwin' ? [{
    label: 'About ' + appName,
    role: 'about',
    click() {
      electron.dialog.showMessageBox(mainWindow, {
        buttons: ['OK'],
        message: `${appName} Desktop ${electron.app.getVersion()}`
      });
    }
  }, separatorItem, {
    label: 'Preferences...',
    accelerator: 'CmdOrCtrl+,',
    click() {
      mainWindow.loadURL(settingsURL);
    }
  }, {
    label: 'Sign in to Another Server',
    click() {
      mainWindow.webContents.send('add-server');
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
    click() {
      mainWindow.loadURL(settingsURL);
    }
  }, {
    label: 'Sign in to Another Server',
    click() {
      mainWindow.webContents.send('add-server');
    }
  }, separatorItem, {
    role: 'quit',
    accelerator: 'CmdOrCtrl+Q',
    click() {
      electron.app.quit();
    }
  }];

  template.push({
    label: '&' + firstMenuName,
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
    }]
  });
  template.push({
    label: '&View',
    submenu: [{
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click(item, focusedWindow) {
        if (focusedWindow) {
          if (focusedWindow === mainWindow) {
            mainWindow.webContents.send('reload-tab');
          } else {
            focusedWindow.reload();
          }
        }
      }
    }, {
      label: 'Clear Cache and Reload',
      accelerator: 'Shift+CmdOrCtrl+R',
      click(item, focusedWindow) {
        if (focusedWindow) {
          if (focusedWindow === mainWindow) {
            mainWindow.webContents.send('clear-cache-and-reload-tab');
          } else {
            focusedWindow.webContents.session.clearCache(() => {
              focusedWindow.reload();
            });
          }
        }
      }
    }, {
      role: 'togglefullscreen'
    }, separatorItem, {
      role: 'resetzoom'
    }, {
      role: 'zoomin'
    }, {
      label: 'Zoom In (hidden)',
      accelerator: 'CmdOrCtrl+=',
      visible: false,
      role: 'zoomin'
    }, {
      role: 'zoomout'
    }, {
      label: 'Zoom Out (hidden)',
      accelerator: 'CmdOrCtrl+Shift+-',
      visible: false,
      role: 'zoomout'
    }, separatorItem, {
      label: 'Toggle Developer Tools',
      accelerator: (() => {
        if (process.platform === 'darwin') {
          return 'Alt+Command+I';
        }
        return 'Ctrl+Shift+I';
      })(),
      click(item, focusedWindow) {
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
        } else if (focusedWindow.webContents.canGoBack()) {
          focusedWindow.goBack();
        }
      }
    }, {
      label: 'Forward',
      accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
      click: (item, focusedWindow) => {
        if (focusedWindow === mainWindow) {
          mainWindow.webContents.send('go-forward');
        } else if (focusedWindow.webContents.canGoForward()) {
          focusedWindow.goForward();
        }
      }
    }]
  });

  const windowMenu = {
    label: '&Window',
    submenu: [{
      role: 'minimize'
    }, {
      role: 'close'
    }, separatorItem, ...config.teams.slice(0, 9).map((team, i) => {
      return {
        label: team.name,
        accelerator: `CmdOrCtrl+${i + 1}`,
        click() {
          mainWindow.show(); // for OS X
          mainWindow.webContents.send('switch-tab', i);
        }
      };
    }), separatorItem, {
      label: 'Select Next Server',
      accelerator: (process.platform === 'darwin') ? 'Alt+Cmd+Right' : 'CmdOrCtrl+Tab',
      click() {
        mainWindow.webContents.send('select-next-tab');
      },
      enabled: (config.teams.length > 1)
    }, {
      label: 'Select Previous Server',
      accelerator: (process.platform === 'darwin') ? 'Alt+Cmd+Left' : 'CmdOrCtrl+Shift+Tab',
      click() {
        mainWindow.webContents.send('select-previous-tab');
      },
      enabled: (config.teams.length > 1)
    }]
  };
  template.push(windowMenu);

  template.push({
    label: '&Help',
    submenu: [{
      label: 'Learn More...',
      click() {
        electron.shell.openExternal(config.helpLink);
      }
    }, {
      type: 'separator'
    }, {
      label: `Version ${electron.app.getVersion()}`,
      enabled: false
    }]
  });
  return template;
}

function createMenu(mainWindow, config, isDev) {
  return Menu.buildFromTemplate(createTemplate(mainWindow, config, isDev));
}

module.exports = {
  createMenu
};
