// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app, dialog, Menu, session, shell, webContents} from 'electron';

import * as WindowManager from '../windows/windowManager';

const ZOOM_DIFFERENTIAL = 0.5;

function createTemplate(config, viewManager) {
  const separatorItem = {
    type: 'separator',
  };

  const isMac = process.platform === 'darwin';
  const appName = app.name;
  const firstMenuName = isMac ? appName : 'File';
  const template = [];

  const settingsLabel = isMac ? 'Preferences...' : 'Settings...';

  let platformAppMenu = [];
  if (isMac) {
    platformAppMenu.push(
      {
        label: 'About ' + appName,
        role: 'about',
        click() {
          dialog.showMessageBox(WindowManager.getMainWindow(), {
            buttons: ['OK'],
            message: `${appName} Desktop ${app.getVersion()}`,
          });
        },
      }
    );
    platformAppMenu.push(separatorItem);
  }
  platformAppMenu.push({
    label: settingsLabel,
    accelerator: 'CmdOrCtrl+,',
    click() {
      WindowManager.showSettingsWindow();
    },
  });

  if (config.enableServerManagement === true) {
    platformAppMenu.push({
      label: 'Sign in to Another Server',
      click() {
        WindowManager.sendToRenderer('add-server');
      },
    });
  }

  if (isMac) {
    platformAppMenu = platformAppMenu.concat([
      separatorItem, {
        role: 'hide',
      }, {
        role: 'hideothers',
      }, {
        role: 'unhide',
      }, separatorItem, {
        role: 'quit',
      }]);
  } else {
    platformAppMenu = platformAppMenu.concat([
      separatorItem, {
        role: 'quit',
        accelerator: 'CmdOrCtrl+Q',
        click() {
          app.quit();
        },
      }]);
  }

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
        const focused = webContents.getFocusedWebContents();
        focused.undo();
      },
    }, {
      label: 'Redo',
      accelerator: 'CmdOrCtrl+SHIFT+Z',
      click() {
        const focused = webContents.getFocusedWebContents();
        focused.redo();
      },
    }, separatorItem, {
      label: 'Cut',
      accelerator: 'CmdOrCtrl+X',
      click() {
        const focused = webContents.getFocusedWebContents();
        focused.cut();
      },
    }, {
      label: 'Copy',
      accelerator: 'CmdOrCtrl+C',
      click() {
        const focused = webContents.getFocusedWebContents();
        console.log(`I got the focused window ${focused.id}, sending copy command`);
        focused.copy();
      },
    }, {
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      click() {
        const focused = webContents.getFocusedWebContents();
        focused.paste();
      },
    }, {
      label: 'Paste and Match Style',
      accelerator: 'CmdOrCtrl+SHIFT+V',
      visible: process.platform === 'darwin',
      click() {
        const focused = webContents.getFocusedWebContents();
        focused.pasteAndMatchStyle();
      },
    }, {
      role: 'selectall',
      accelerator: 'CmdOrCtrl+A',
    }],
  });

  const viewSubMenu = [{
    label: 'Find..',
    accelerator: 'CmdOrCtrl+F',
    click() {
      const focused = webContents.getFocusedWebContents();
      focused.findInPage();
    },
  }, {
    label: 'Reload',
    accelerator: 'CmdOrCtrl+R',
    click() {
      const focused = webContents.getFocusedWebContents();
      focused.reload();
    },
  }, {
    label: 'Clear Cache and Reload',
    accelerator: 'Shift+CmdOrCtrl+R',
    click() {
      session.defaultSession.clearCache();
      const focused = webContents.getFocusedWebContents();
      focused.reload();
    },
  }, {
    role: 'togglefullscreen',
    accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
  }, separatorItem, {
    label: 'Actual Size',
    accelerator: 'CmdOrCtrl+0',
    click() {
      const focused = webContents.getFocusedWebContents();
      focused.setZoomLevel(1);
    },
  }, {
    label: 'Zoom In',
    accelerator: 'CmdOrCtrl+SHIFT+=',
    click() {
      const focused = webContents.getFocusedWebContents();
      const level = focused.getZoomLevel();
      if (level <= 3) {
        focused.setZoomLevel(level + ZOOM_DIFFERENTIAL);
      }
    },
  }, {
    label: 'Zoom Out',
    accelerator: 'CmdOrCtrl+-',
    click() {
      const focused = webContents.getFocusedWebContents();
      const level = focused.getZoomLevel();
      if (level >= 0) {
        focused.setZoomLevel(level - ZOOM_DIFFERENTIAL);
      }
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
      viewManager.openViewDevTools();
    },
  }];

  if (process.platform !== 'darwin') {
    viewSubMenu.push(separatorItem);
    viewSubMenu.push({
      label: 'Toggle Dark Mode',
      click() {
        // TODO: review what to do with this one
        WindowManager.sendToRenderer('set-dark-mode');
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
        if (WindowManager.isMainWindow(focusedWindow)) {
          WindowManager.sendToRenderer('go-back');
        } else if (focusedWindow.webContents.canGoBack()) {
          focusedWindow.webContents.goBack();
        }
      },
    }, {
      label: 'Forward',
      accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
      click: (item, focusedWindow) => {
        if (WindowManager.isMainWindow(focusedWindow)) {
          WindowManager.sendToRenderer('go-forward');
        } else if (focusedWindow.webContents.canGoForward()) {
          focusedWindow.webContents.goForward();
        }
      },
    }],
  });

  const teams = config.teams || [];
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
          WindowManager.showMainWindow(); // for OS X
          WindowManager.sendToRenderer('switch-tab', i);
        },
      };
    }), separatorItem, {
      label: 'Select Next Server',
      accelerator: 'Ctrl+Tab',
      click() {
        WindowManager.sendToRenderer('select-next-tab');
      },
      enabled: (teams.length > 1),
    }, {
      label: 'Select Previous Server',
      accelerator: 'Ctrl+Shift+Tab',
      click() {
        WindowManager.sendToRenderer('select-previous-tab');
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

function createMenu(config, viewManager) {
  return Menu.buildFromTemplate(createTemplate(config, viewManager));
}

export default {
  createMenu,
};
