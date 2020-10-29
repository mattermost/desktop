// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {Menu} from 'electron';

import * as WindowManager from '../windows/windowManager';
import {ViewManager} from '../viewManager';

function createTemplate(config) {
  const teams = config.teams;
  const template = [
    ...teams.slice(0, 9).sort((teamA, teamB) => teamA.order - teamB.order).map((team, i) => {
      return {
        label: team.name,
        click: () => {
          WindowManager.restoreMain();
          WindowManager.sendToRenderer('switch-tab', i);
          ViewManager.showByName(team.name);
        },
      };
    }), {
      type: 'separator',
    }, {
      label: process.platform === 'darwin' ? 'Preferences...' : 'Settings',
      click: () => {
        WindowManager.showSettingsWindow();
      },
    }, {
      type: 'separator',
    }, {
      role: 'quit',
    },
  ];
  return template;
}

function createMenu(mainWindow, config) {
  return Menu.buildFromTemplate(createTemplate(config));
}

export default {
  createMenu,
};
