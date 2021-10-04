// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app, ipcMain, Menu, MenuItemConstructorOptions, MenuItem, session, shell, WebContents, webContents} from 'electron';

import {SHOW_NEW_SERVER_MODAL} from 'common/communication';
import Config from 'common/config';
import {TabType, getTabDisplayName} from 'common/tabs/TabView';

import * as WindowManager from '../windows/windowManager';

function createTemplate(config: Config) {
    const separatorItem: MenuItemConstructorOptions = {
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
            },
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

    if (config.data?.enableServerManagement === true) {
        platformAppMenu.push({
            label: 'Sign in to Another Server',
            click() {
                ipcMain.emit(SHOW_NEW_SERVER_MODAL);
            },
        });
    }

    if (isMac) {
        platformAppMenu = platformAppMenu.concat([
            separatorItem, {
                role: 'hide',
            }, {
                role: 'hideOthers',
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
            role: 'undo',
            accelerator: 'CmdOrCtrl+Z',
        }, {
            role: 'Redo',
            accelerator: 'CmdOrCtrl+SHIFT+Z',
        }, separatorItem, {
            role: 'cut',
            accelerator: 'CmdOrCtrl+X',
        }, {
            role: 'copy',
            accelerator: 'CmdOrCtrl+C',
        }, {
            role: 'paste',
            accelerator: 'CmdOrCtrl+V',
        }, {
            role: 'pasteAndMatchStyle',
            accelerator: 'CmdOrCtrl+SHIFT+V',
        }, {
            role: 'selectall',
            accelerator: 'CmdOrCtrl+A',
        }],
    });

    const viewSubMenu = [{
        label: 'Find..',
        accelerator: 'CmdOrCtrl+F',
        click() {
            WindowManager.sendToFind();
        },
    }, {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click() {
            WindowManager.reload();
        },
    }, {
        label: 'Clear Cache and Reload',
        accelerator: 'Shift+CmdOrCtrl+R',
        click() {
            session.defaultSession.clearCache();
            WindowManager.reload();
        },
    }, {
        role: 'togglefullscreen',
        accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
    }, separatorItem, {
        label: 'Actual Size',
        role: 'resetZoom',
        accelerator: 'CmdOrCtrl+0',
    }, {
        role: 'zoomIn',
        accelerator: 'CmdOrCtrl+SHIFT+=',
    }, {
        role: 'zoomOut',
        accelerator: 'CmdOrCtrl+-',
    }, separatorItem, {
        label: 'Developer Tools for Application Wrapper',
        accelerator: (() => {
            if (process.platform === 'darwin') {
                return 'Alt+Command+I';
            }
            return 'Ctrl+Shift+I';
        })(),
        click(item: Electron.MenuItem, focusedWindow?: WebContents) {
            if (focusedWindow) {
                // toggledevtools opens it in the last known position, so sometimes it goes below the browserview
                if (focusedWindow.isDevToolsOpened()) {
                    focusedWindow.closeDevTools();
                } else {
                    focusedWindow.openDevTools({mode: 'detach'});
                }
            }
        },
    }, {
        label: 'Developer Tools for Current Tab',
        click() {
            WindowManager.openBrowserViewDevTools();
        },
    }];

    if (process.platform !== 'darwin' && process.platform !== 'win32') {
        viewSubMenu.push(separatorItem);
        viewSubMenu.push({
            label: 'Toggle Dark Mode',
            click() {
                config.toggleDarkModeManually();
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
            click: () => {
                const focused = webContents.getFocusedWebContents();
                if (focused.canGoBack()) {
                    focused.goBack();
                }
            },
        }, {
            label: 'Forward',
            accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
            click: () => {
                const focused = webContents.getFocusedWebContents();
                if (focused.canGoForward()) {
                    focused.goForward();
                }
            },
        }],
    });

    const teams = config.data?.teams || [];
    const windowMenu = {
        label: '&Window',
        role: isMac ? 'windowMenu' : null,
        submenu: [{
            role: 'minimize',

            // empty string removes shortcut on Windows; null will default by OS
            accelerator: process.platform === 'win32' ? '' : null,
        }, ...(isMac ? [{
            role: 'zoom',
        }, separatorItem,
        ] : []), {
            role: 'close',
            accelerator: 'CmdOrCtrl+W',
        }, separatorItem, ...teams.slice(0, 9).sort((teamA, teamB) => teamA.order - teamB.order).map((team, i) => {
            const items = [];
            items.push({
                label: team.name,
                accelerator: `${process.platform === 'darwin' ? 'Cmd+Ctrl' : 'Ctrl+Shift'}+${i + 1}`,
                click() {
                    WindowManager.switchServer(team.name);
                },
            });
            if (WindowManager.getCurrentTeamName() === team.name) {
                team.tabs.filter((tab) => tab.isOpen).slice(0, 9).sort((teamA, teamB) => teamA.order - teamB.order).forEach((tab, i) => {
                    items.push({
                        label: `    ${getTabDisplayName(tab.name as TabType)}`,
                        accelerator: `CmdOrCtrl+${i + 1}`,
                        click() {
                            WindowManager.switchTab(team.name, tab.name);
                        },
                    });
                });
            }
            return items;
        }).flat(), separatorItem, {
            label: 'Select Next Tab',
            accelerator: 'Ctrl+Tab',
            click() {
                WindowManager.selectNextTab();
            },
            enabled: (teams.length > 1),
        }, {
            label: 'Select Previous Tab',
            accelerator: 'Ctrl+Shift+Tab',
            click() {
                WindowManager.selectPreviousTab();
            },
            enabled: (teams.length > 1),
        }, ...(isMac ? [separatorItem, {
            role: 'front',
        }] : []),
        ],
    };
    template.push(windowMenu);
    const submenu = [];
    if (config.data?.helpLink) {
        submenu.push({
            label: 'Learn More...',
            click() {
                shell.openExternal(config.data!.helpLink);
            },
        });
        submenu.push(separatorItem);
    }
    submenu.push({
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        label: `Version ${app.getVersion()}${__HASH_VERSION__ ? ` commit: ${__HASH_VERSION__}` : ''}`,
        enabled: false,
    });

    template.push({label: 'Hel&p', submenu});
    return template;
}

function createMenu(config: Config) {
    // TODO: Electron is enforcing certain variables that it doesn't need
    return Menu.buildFromTemplate(createTemplate(config) as Array<MenuItemConstructorOptions | MenuItem>);
}

export default {
    createMenu,
};
