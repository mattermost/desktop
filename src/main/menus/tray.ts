// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {Menu, MenuItem, MenuItemConstructorOptions} from 'electron';

import WindowManager from 'main/windows/windowManager';
import {localizeMessage} from 'main/i18nManager';
import ServerManager from 'common/servers/serverManager';

export function createTemplate() {
    const teams = ServerManager.getOrderedServers();
    const template = [
        ...teams.slice(0, 9).map((team) => {
            return {
                label: team.name.length > 50 ? `${team.name.slice(0, 50)}...` : team.name,
                click: () => {
                    WindowManager.switchServer(team.id);
                },
            };
        }), {
            type: 'separator',
        }, {
            label: process.platform === 'darwin' ? localizeMessage('main.menus.tray.preferences', 'Preferences...') : localizeMessage('main.menus.tray.settings', 'Settings'),
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

export function createMenu() {
    // Electron is enforcing certain variables that it doesn't need
    return Menu.buildFromTemplate(createTemplate() as Array<MenuItemConstructorOptions | MenuItem>);
}
