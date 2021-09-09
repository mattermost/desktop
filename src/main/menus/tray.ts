// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {Menu, MenuItem, MenuItemConstructorOptions} from 'electron';
import {CombinedConfig} from 'types/config';

import * as WindowManager from '../windows/windowManager';

function createTemplate(config: CombinedConfig) {
    const teams = config.teams;
    const template = [
        ...teams.slice(0, 9).sort((teamA, teamB) => teamA.order - teamB.order).map((team) => {
            return {
                label: team.name,
                click: () => {
                    WindowManager.switchServer(team.name);
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

function createMenu(config: CombinedConfig) {
    // TODO: Electron is enforcing certain variables that it doesn't need
    return Menu.buildFromTemplate(createTemplate(config) as Array<MenuItemConstructorOptions | MenuItem>);
}

export default {
    createMenu,
};
