// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import type {MenuItem, MenuItemConstructorOptions} from 'electron';
import {Menu} from 'electron';

import ServerViewState from 'app/serverViewState';
import ServerManager from 'common/servers/serverManager';
import {localizeMessage} from 'main/i18nManager';
import SettingsWindow from 'main/windows/settingsWindow';

export function createTemplate() {
    const servers = ServerManager.getOrderedServers();
    const template = [
        ...servers.slice(0, 9).map((server) => {
            return {
                label: server.name.length > 50 ? `${server.name.slice(0, 50)}...` : server.name,
                click: () => {
                    ServerViewState.switchServer(server.id);
                },
            };
        }), {
            type: 'separator',
        }, {
            label: process.platform === 'darwin' ? localizeMessage('main.menus.tray.preferences', 'Preferences...') : localizeMessage('main.menus.tray.settings', 'Settings'),
            click: () => {
                SettingsWindow.show();
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
