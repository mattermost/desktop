// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app, dialog, Menu, shell} from 'electron';

function createTemplate(mainWindow, config, isDev) {
  const settingsURL = isDev ? 'http://localhost:8080/browser/settings.html' : `file://${app.getAppPath()}/browser/settings.html`;

  const separatorItem = {
    type: 'separator',
  };

  const appName = app.name;
  const firstMenuName = (process.platform === 'darwin') ? appName : 'File';
  const template = [];

  let platformAppMenu = process.platform === 'darwin' ? [{
    label: 'About ' + appName,
    role: 'about',
    click() {
      dialog.showMessageBox(mainWindow, {
        buttons: ['OK'],
        message: `${appName} Desktop ${app.getVersion()}`,
      });
    },
  }, separatorItem, {
    label: 'Preferences...',
    accelerator: 'CmdOrCtrl+,',
    click() {
      mainWindow.loadURL(settingsURL);
    },
  }] : [{
    label: 'Settings...',
    accelerator: 'CmdOrCtrl+,',
    click() {
      mainWindow.loadURL(settingsURL);
    },
  }];

  if (config.enableServerManagement === true) {
    platformAppMenu.push({
      label: 'Sign in to Another Server',
      click() {
        mainWindow.webContents.send('add-server');
      },
    });
  }

  platformAppMenu = platformAppMenu.concat(process.platform === 'darwin' ? [
    separatorItem, {
      role: 'hide',
    }, {
      role: 'hideothers',
    }, {
      role: 'unhide',
    }, separatorItem, {
      role: 'quit',
    }] : [
    separatorItem, {
      role: 'quit',
      accelerator: 'CmdOrCtrl+Q',
      click() {
        app.quit();
      },
    }]
  );

  template.push({
    label: '&' + firstMenuName,
    submenu: [
      ...platformAppMenu,
    ],
  });
  template.push({
    label: '&Edit',
    submenu: [{
      label: 'Undo',
      accelerator: 'CmdOrCtrl+Z',
      click() {
        mainWindow.webContents.send('undo');
      },
    }, {
      label: 'Redo',
      accelerator: 'CmdOrCtrl+SHIFT+Z',
      click() {
        mainWindow.webContents.send('redo');
      },
    }, separatorItem, {
      label: 'Cut',
      accelerator: 'CmdOrCtrl+X',
      click() {
        mainWindow.webContents.send('cut');
      },
    }, {
      label: 'Copy',
      accelerator: 'CmdOrCtrl+C',
      click() {
        mainWindow.webContents.send('copy');
      },
    }, {
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      click() {
        mainWindow.webContents.send('paste');
      },
    }, {
      label: 'Paste and Match Style',
      accelerator: 'CmdOrCtrl+SHIFT+V',
      visible: process.platform === 'darwin',
      click() {
        mainWindow.webContents.send('paste-and-match');
      },
    }, {
      role: 'selectall',
      accelerator: 'CmdOrCtrl+A',
    }],
  });

  const viewSubMenu = [{
    label: 'Find..',
    accelerator: 'CmdOrCtrl+F',
    click(item, focusedWindow) {
      focusedWindow.webContents.send('toggle-find');
    },
  }, {
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
    },
  }, {
    label: 'Clear Cache and Reload',
    accelerator: 'Shift+CmdOrCtrl+R',
    click(item, focusedWindow) {
      if (focusedWindow) {
        if (focusedWindow === mainWindow) {
          mainWindow.webContents.send('clear-cache-and-reload-tab');
        } else {
          focusedWindow.webContents.session.clearCache().then(focusedWindow.reload);
        }
      }
    },
  }, {
    role: 'togglefullscreen',
    accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
  }, separatorItem, {
    label: 'Actual Size',
    accelerator: 'CmdOrCtrl+0',
    click() {
      mainWindow.webContents.send('zoom-reset');
    },
  }, {
    label: 'Zoom In',
    accelerator: 'CmdOrCtrl+SHIFT+=',
    click() {
      mainWindow.webContents.send('zoom-in');
    },
  }, {
    label: 'Zoom Out',
    accelerator: 'CmdOrCtrl+-',
    click() {
      mainWindow.webContents.send('zoom-out');
    },
  }, separatorItem, {
    label: 'Developer Tools for Application Wrapper',
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
    },
  }, {
    label: 'Developer Tools for Current Server',
    click() {
      mainWindow.webContents.send('open-devtool');
    },
  }];

  if (process.platform !== 'darwin') {
    viewSubMenu.push(separatorItem);
    viewSubMenu.push({
      label: 'Toggle Dark Mode',
      click() {
        mainWindow.webContents.send('set-dark-mode');
      },
    });
  }

  template.push({
    label: '&View',
    submenu: viewSubMenu,
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
          focusedWindow.webContents.goBack();
        }
      },
    }, {
      label: 'Forward',
      accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
      click: (item, focusedWindow) => {
        if (focusedWindow === mainWindow) {
          mainWindow.webContents.send('go-forward');
        } else if (focusedWindow.webContents.canGoForward()) {
          focusedWindow.webContents.goForward();
        }
      },
    }],
  });

  const teams = config.teams;
  const windowMenu = {
    label: '&Window',
    submenu: [{
      role: 'minimize',

      // empty string removes shortcut on Windows; null will default by OS
      accelerator: process.platform === 'win32' ? '' : null,
    }, {
      role: 'close',
      accelerator: 'CmdOrCtrl+W',
    }, separatorItem, ...teams.slice(0, 9).sort((teamA, teamB) => teamA.order - teamB.order).map((team, i) => {
      return {
        label: team.name,
        accelerator: `CmdOrCtrl+${i + 1}`,
        click() {
          mainWindow.show(); // for OS X
          mainWindow.webContents.send('switch-tab', i);
        },
      };
    }), separatorItem, {
      label: 'Select Next Server',
      accelerator: 'Ctrl+Tab',
      click() {
        mainWindow.webContents.send('select-next-tab');
      },
      enabled: (teams.length > 1),
    }, {
      label: 'Select Previous Server',
      accelerator: 'Ctrl+Shift+Tab',
      click() {
        mainWindow.webContents.send('select-previous-tab');
      },
      enabled: (teams.length > 1),
    }],
  };
  template.push(windowMenu);
  const submenu = [];
  if (config.helpLink) {
    submenu.push({
      label: 'Learn More...',
      click() {
        shell.openExternal(config.helpLink);
      },
    });
    submenu.push(separatorItem);
  }
  submenu.push({
    label: `Version ${app.getVersion()}`,
    enabled: false,
  });

  template.push({label: 'Hel&p', submenu});
  return template;
}

function createMenu(mainWindow, config, isDev) {
  return Menu.buildFromTemplate(createTemplate(mainWindow, config, isDev));
}

export default {
  createMenu,
};
