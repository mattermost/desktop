// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {Menu} from 'electron';

import * as WindowManager from '../windows/windowManager';
import {ViewManager} from '../viewManager';

// TODO: remove viewmanager once move to windowmanager is completed
function createTemplate(config, viewManager) {
  const teams = config.teams;
  const template = [
    ...teams.slice(0, 9).sort((teamA, teamB) => teamA.order - teamB.order).map((team, i) => {
      return {
        label: team.name,
        click: () => {
          WindowManager.restoreMain();
          WindowManager.sendToRenderer('switch-tab', i);
          viewManager.showByName(team.name);
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

function createMenu(config, viewManager) {
  return Menu.buildFromTemplate(createTemplate(config, viewManager));
}

export default {
  createMenu,
};
