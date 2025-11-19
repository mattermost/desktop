// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MenuItemConstructorOptions, BaseWindow, MenuItem} from 'electron';
import {app, BrowserWindow} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import ServerHub from 'app/serverHub';
import TabManager from 'app/tabs/tabManager';
import PopoutManager from 'app/windows/popoutManager';
import Config from 'common/config';
import ServerManager from 'common/servers/serverManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {handleShowSettingsModal} from 'main/app/intercom';
import {localizeMessage} from 'main/i18nManager';

export function createAppMenu(): MenuItemConstructorOptions {
    const appName = app.name;
    return {
        id: 'app',
        label: '&' + appName,
        submenu: [
            {
                label: localizeMessage('main.menus.app.file.about', 'About {appName}', {appName}),
                role: 'about',
            },
            {type: 'separator'},
            ...getSettingsAndSignInToAnotherServerMenu(),
            {type: 'separator'},
            {
                role: 'hide',
                label: localizeMessage('main.menus.app.file.hide', 'Hide {appName}', {appName}),
            }, {
                role: 'hideOthers',
                label: localizeMessage('main.menus.app.file.hideOthers', 'Hide Others'),
            }, {
                role: 'unhide',
                label: localizeMessage('main.menus.app.file.unhide', 'Show All'),
            }, {type: 'separator'}, {
                role: 'quit',
                label: localizeMessage('main.menus.app.file.quit', 'Quit {appName}', {appName}),
            },
        ],
    };
}

export function createFileMenu() {
    const fileMenu: MenuItemConstructorOptions[] = getBaseFileMenu();

    if (process.platform !== 'darwin') {
        fileMenu.push(
            {type: 'separator'},
            ...getSettingsAndSignInToAnotherServerMenu(),
            {type: 'separator'}, {
                role: 'quit',
                label: localizeMessage('main.menus.app.file.exit', 'Exit'),
                accelerator: 'CmdOrCtrl+Q',
            });
    }

    return {
        id: 'file',
        label: localizeMessage('main.menus.app.file', '&File'),
        submenu: fileMenu,
    };
}

function getBaseFileMenu(): MenuItemConstructorOptions[] {
    const baseFileMenu: MenuItemConstructorOptions[] = [];
    const currentServerId = ServerManager.getCurrentServerId();
    if (currentServerId) {
        baseFileMenu.push({
            label: localizeMessage('main.menus.app.window.newWindow', 'New Window'),
            accelerator: 'CmdOrCtrl+N',
            enabled: !ViewManager.isViewLimitReached(),
            click() {
                PopoutManager.createNewWindow(currentServerId);
            },
        },
        {
            label: localizeMessage('main.menus.app.window.newTab', 'New Tab'),
            accelerator: 'CmdOrCtrl+T',
            enabled: !ViewManager.isViewLimitReached(),
            click() {
                const server = ServerManager.getServer(currentServerId);
                if (!server) {
                    return;
                }
                const view = ViewManager.createView(server, ViewType.TAB);
                if (!view) {
                    return;
                }
                TabManager.switchToTab(view.id);
            },
        }, {type: 'separator'});
    }

    baseFileMenu.push({
        role: 'close',
        label: localizeMessage('main.menus.app.window.closeWindow', 'Close Window'),
        accelerator: (BrowserWindow.getFocusedWindow() === MainWindow.get()) ? 'CmdOrCtrl+Shift+W' : 'CmdOrCtrl+W',
    });

    const tabs = currentServerId ? TabManager.getOrderedTabsForServer(currentServerId) : [];
    if (BrowserWindow.getFocusedWindow() === MainWindow.get()) {
        if (tabs.length > 1) {
            baseFileMenu.push({
                label: localizeMessage('main.menus.app.window.closeTab', 'Close Tab'),
                accelerator: 'CmdOrCtrl+W',
                click(_: MenuItem, window?: BaseWindow) {
                    if (MainWindow.get() === window) {
                        const view = TabManager.getCurrentActiveTabView();
                        if (view) {
                            ViewManager.removeView(view.id);
                        }
                    } else {
                        window?.close();
                    }
                },
            });
        } else {
            baseFileMenu.push({
                label: localizeMessage('main.menus.app.window.closeWindow', 'Close Window'),
                visible: false,
                accelerator: 'CmdOrCtrl+W',
                click() {
                    MainWindow.get()?.close();
                },
            });
        }
    }

    return baseFileMenu;
}

function getSettingsAndSignInToAnotherServerMenu(): MenuItemConstructorOptions[] {
    const settingsLabel = process.platform === 'darwin' ? localizeMessage('main.menus.app.file.preferences', 'Preferences...') : localizeMessage('main.menus.app.file.settings', 'Settings...');
    const platformAppMenu: MenuItemConstructorOptions[] = [{
        label: settingsLabel,
        accelerator: 'CmdOrCtrl+,',
        click() {
            handleShowSettingsModal();
        },
    }];

    if (Config.enableServerManagement === true && ServerManager.hasServers()) {
        platformAppMenu.push({
            label: localizeMessage('main.menus.app.file.signInToAnotherServer', 'Sign in to Another Server'),
            click() {
                ServerHub.showNewServerModal();
            },
        });
    }

    return platformAppMenu;
}
