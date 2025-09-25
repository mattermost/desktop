// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain, type MenuItemConstructorOptions} from 'electron';

import TabManager from 'app/tabs/tabManager';
import {OPEN_SERVERS_DROPDOWN} from 'common/communication';
import ServerManager from 'common/servers/serverManager';
import ViewManager from 'common/views/viewManager';
import {localizeMessage} from 'main/i18nManager';

import type {UniqueView} from 'types/config';

export default function createWindowMenu(): MenuItemConstructorOptions {
    const windowSubMenu: MenuItemConstructorOptions[] = [];
    windowSubMenu.push({
        role: 'minimize',
        label: localizeMessage('main.menus.app.window.minimize', 'Minimize'),

        // empty string removes shortcut on Windows; null will default by OS
        accelerator: process.platform === 'win32' ? '' : undefined,
    });
    if (process.platform === 'darwin') {
        windowSubMenu.push({
            role: 'zoom',
            label: localizeMessage('main.menus.app.window.zoom', 'Zoom'),
        }, {type: 'separator'});
    }
    if (ServerManager.hasServers()) {
        windowSubMenu.push({
            label: localizeMessage('main.menus.app.window.showServers', 'Show Servers'),
            accelerator: `${process.platform === 'darwin' ? 'Cmd+Ctrl' : 'Ctrl+Shift'}+S`,
            click() {
                ipcMain.emit(OPEN_SERVERS_DROPDOWN);
            },
        });
    }
    const currentServerId = ServerManager.getCurrentServerId();
    const serverItems = ServerManager.getOrderedServers().slice(0, 9).map((server, i) => {
        const items: MenuItemConstructorOptions[] = [];
        items.push({
            label: server.name,
            accelerator: `${process.platform === 'darwin' ? 'Cmd+Ctrl' : 'Ctrl+Shift'}+${i + 1}`,
            click() {
                ServerManager.updateCurrentServer(server.id);
            },
        });
        if (currentServerId === server.id) {
            TabManager.getOrderedTabsForServer(server.id).slice(0, 9).forEach((view: UniqueView, i: number) => {
                items.push({
                    label: `    ${ViewManager.getViewTitle(view.id)}`,
                    accelerator: `CmdOrCtrl+${i + 1}`,
                    click() {
                        TabManager.switchToTab(view.id);
                    },
                });
            });
        }
        return items;
    }).flat();
    windowSubMenu.push(...serverItems);
    windowSubMenu.push({type: 'separator'});
    if (currentServerId) {
        windowSubMenu.push({
            label: localizeMessage('main.menus.app.window.selectNextTab', 'Select Next Tab'),
            accelerator: 'Ctrl+Tab',
            click() {
                TabManager.switchToNextTab();
            },
        }, {
            label: localizeMessage('main.menus.app.window.selectPreviousTab', 'Select Previous Tab'),
            accelerator: 'Ctrl+Shift+Tab',
            click() {
                TabManager.switchToPreviousTab();
            },
        });
    }
    if (process.platform === 'darwin') {
        windowSubMenu.push({type: 'separator'}, {
            role: 'front',
            label: localizeMessage('main.menus.app.window.bringAllToFront', 'Bring All to Front'),
        });
    }
    return {
        id: 'window',
        label: localizeMessage('main.menus.app.window', '&Window'),
        role: process.platform === 'darwin' ? 'windowMenu' : undefined,
        submenu: windowSubMenu,
    };
}
