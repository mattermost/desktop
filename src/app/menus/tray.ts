// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import type {MenuItemConstructorOptions} from 'electron';
import {Menu} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import {ModalConstants} from 'common/constants';
import ServerManager from 'common/servers/serverManager';
import {localizeMessage} from 'main/i18nManager';
import {getLocalPreload} from 'main/utils';

export function createTemplate() {
    const servers = ServerManager.getOrderedServers();
    const template: MenuItemConstructorOptions[] = [
        ...servers.slice(0, 9).map((server) => {
            return {
                label: server.name.length > 50 ? `${server.name.slice(0, 50)}...` : server.name,
                click: () => {
                    ServerManager.updateCurrentServer(server.id);
                },
            };
        }), {
            type: 'separator',
        }, {
            label: process.platform === 'darwin' ? localizeMessage('main.menus.tray.preferences', 'Preferences...') : localizeMessage('main.menus.tray.settings', 'Settings'),
            click: () => {
                const mainWindow = MainWindow.get();
                if (!mainWindow) {
                    return;
                }

                ModalManager.addModal(
                    ModalConstants.SETTINGS_MODAL,
                    'mattermost-desktop://renderer/settings.html',
                    getLocalPreload('internalAPI.js'),
                    null,
                    mainWindow,
                );
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
    return Menu.buildFromTemplate(createTemplate());
}
