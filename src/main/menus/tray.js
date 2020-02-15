// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app, Menu} from 'electron';

function createTemplate(mainWindow, config, isDev) {
  const settingsURL = isDev ? 'http://localhost:8080/browser/settings.html' : `file://${app.getAppPath()}/browser/settings.html`;
  const teams = config.teams;
  const template = [
    ...teams.slice(0, 9).sort((teamA, teamB) => teamA.order - teamB.order).map((team, i) => {
      return {
        label: team.name,
        click: () => {
          showOrRestore(mainWindow);
          mainWindow.webContents.send('switch-tab', i);

          if (process.platform === 'darwin') {
            app.dock.show();
            mainWindow.focus();
          }
        },
      };
    }), {
      type: 'separator',
    }, {
      label: process.platform === 'darwin' ? 'Preferences...' : 'Settings',
      click: () => {
        mainWindow.loadURL(settingsURL);
        showOrRestore(mainWindow);

        if (process.platform === 'darwin') {
          app.dock.show();
          mainWindow.focus();
        }
      },
    }, {
      type: 'separator',
    }, {
      role: 'quit',
    },
  ];
  return template;
}

function createMenu(mainWindow, config, isDev) {
  return Menu.buildFromTemplate(createTemplate(mainWindow, config, isDev));
}

function showOrRestore(window) {
  if (window.isMinimized()) {
    window.restore();
  } else {
    window.show();
  }
}

export default {
  createMenu,
};
