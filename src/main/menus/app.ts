// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app, ipcMain, Menu, MenuItemConstructorOptions, MenuItem, session, shell, WebContents, clipboard} from 'electron';

import {BROWSER_HISTORY_BUTTON, OPEN_TEAMS_DROPDOWN, SHOW_NEW_SERVER_MODAL} from 'common/communication';
import {Config} from 'common/config';

import {t} from 'main/i18nManager';
import WindowManager from 'main/windows/windowManager';
import {UpdateManager} from 'main/autoUpdater';

export function createTemplate(config: Config, updateManager: UpdateManager) {
    const separatorItem: MenuItemConstructorOptions = {
        type: 'separator',
    };

    const isMac = process.platform === 'darwin';
    const appName = app.name;
    const firstMenuName = isMac ? '&' + appName : t('main.menus.app.file', '&File');
    const template = [];

    const settingsLabel = isMac ? t('main.menus.app.file.preferences', 'Preferences...') : t('main.menus.app.file.settings', 'Settings...');

    let platformAppMenu = [];
    if (isMac) {
        platformAppMenu.push(
            {
                label: t('main.menus.app.file.about', 'About {appName}', {appName}),
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
            label: t('main.menus.app.file.signInToAnotherServer', 'Sign in to Another Server'),
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
        label: firstMenuName,
        submenu: [
            ...platformAppMenu,
        ],
    });
    template.push({
        label: t('main.menus.app.edit', '&Edit'),
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
        label: t('main.menus.app.view.find', 'Find..'),
        accelerator: 'CmdOrCtrl+F',
        click() {
            WindowManager.sendToFind();
        },
    }, {
        label: t('main.menus.app.view.reload', 'Reload'),
        accelerator: 'CmdOrCtrl+R',
        click() {
            WindowManager.reload();
        },
    }, {
        label: t('main.menus.app.view.clearCacheAndReload', 'Clear Cache and Reload'),
        accelerator: 'Shift+CmdOrCtrl+R',
        click() {
            session.defaultSession.clearCache();
            WindowManager.reload();
        },
    }, {
        role: 'togglefullscreen',
        accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
    }, separatorItem, {
        label: t('main.menus.app.view.actualSize', 'Actual Size'),
        role: 'resetZoom',
        accelerator: 'CmdOrCtrl+0',
    }, {
        role: 'zoomIn',
        accelerator: 'CmdOrCtrl+=',
    }, {
        role: 'zoomIn',
        visible: false,
        accelerator: 'CmdOrCtrl+Shift+=',
    }, {
        role: 'zoomOut',
        accelerator: 'CmdOrCtrl+-',
    }, {
        role: 'zoomOut',
        visible: false,
        accelerator: 'CmdOrCtrl+Shift+-',
    }, separatorItem, {
        label: t('main.menus.app.view.devToolsAppWrapper', 'Developer Tools for Application Wrapper'),
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
        label: t('main.menus.app.view.devToolsCurrentServer', 'Developer Tools for Current Server'),
        click() {
            WindowManager.openBrowserViewDevTools();
        },
    }];

    if (process.platform !== 'darwin' && process.platform !== 'win32') {
        viewSubMenu.push(separatorItem);
        viewSubMenu.push({
            label: t('main.menus.app.view.toggleDarkMode', 'Toggle Dark Mode'),
            click() {
                config.toggleDarkModeManually();
            },
        });
    }

    template.push({
        label: t('main.menus.app.view', '&View'),
        submenu: viewSubMenu,
    });
    template.push({
        label: t('main.menus.app.history', '&History'),
        submenu: [{
            label: t('main.menus.app.history.back', 'Back'),
            accelerator: process.platform === 'darwin' ? 'Cmd+[' : 'Alt+Left',
            click: () => {
                const view = WindowManager.viewManager?.getCurrentView();
                if (view && view.view.webContents.canGoBack() && !view.isAtRoot) {
                    view.view.webContents.goBack();
                    ipcMain.emit(BROWSER_HISTORY_BUTTON, null, view.name);
                }
            },
        }, {
            label: t('main.menus.app.history.forward', 'Forward'),
            accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
            click: () => {
                const view = WindowManager.viewManager?.getCurrentView();
                if (view && view.view.webContents.canGoForward()) {
                    view.view.webContents.goForward();
                    ipcMain.emit(BROWSER_HISTORY_BUTTON, null, view.name);
                }
            },
        }],
    });

    const teams = config.data?.teams || [];
    const windowMenu = {
        label: t('main.menus.app.window', '&Window'),
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
        }, separatorItem, {
            label: t('main.menus.app.window.showServers', 'Show Servers'),
            accelerator: `${process.platform === 'darwin' ? 'Cmd+Ctrl' : 'Ctrl+Shift'}+S`,
            click() {
                ipcMain.emit(OPEN_TEAMS_DROPDOWN);
            },
        }, ...teams.sort((teamA, teamB) => teamA.order - teamB.order).slice(0, 9).map((team, i) => {
            const items = [];
            items.push({
                label: team.name,
                accelerator: `${process.platform === 'darwin' ? 'Cmd+Ctrl' : 'Ctrl+Shift'}+${i + 1}`,
                click() {
                    WindowManager.switchServer(team.name);
                },
            });
            if (WindowManager.getCurrentTeamName() === team.name) {
                team.tabs.filter((tab) => tab.isOpen).sort((teamA, teamB) => teamA.order - teamB.order).slice(0, 9).forEach((tab, i) => {
                    items.push({
                        label: `    ${t(`common.tabs.${tab.name}`)}`,
                        accelerator: `CmdOrCtrl+${i + 1}`,
                        click() {
                            WindowManager.switchTab(team.name, tab.name);
                        },
                    });
                });
            }
            return items;
        }).flat(), separatorItem, {
            label: t('main.menus.app.window.selectNextTab', 'Select Next Tab'),
            accelerator: 'Ctrl+Tab',
            click() {
                WindowManager.selectNextTab();
            },
            enabled: (teams.length > 1),
        }, {
            label: t('main.menus.app.window.selectPreviousTab', 'Select Previous Tab'),
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
    if (updateManager && config.canUpgrade) {
        if (updateManager.versionDownloaded) {
            submenu.push({
                label: t('main.menus.app.help.restartAndUpdate', 'Restart and Update'),
                click() {
                    updateManager.handleUpdate();
                },
            });
        } else if (updateManager.versionAvailable) {
            submenu.push({
                label: t('main.menus.app.help.downloadUpdate', 'Download Update'),
                click() {
                    updateManager.handleDownload();
                },
            });
        } else {
            submenu.push({
                label: t('main.menus.app.help.checkForUpdates', 'Check for Updates'),
                click() {
                    updateManager.checkForUpdates(true);
                },
            });
        }
    }
    if (config.data?.helpLink) {
        submenu.push({
            label: t('main.menus.app.help.learnMore', 'Learn More...'),
            click() {
                shell.openExternal(config.data!.helpLink);
            },
        });
        submenu.push(separatorItem);
    }

    const version = t('main.menus.app.help.versionString', 'Version {version}{commit}', {
        version: app.getVersion(),
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        commit: __HASH_VERSION__ ? t('main.menus.app.help.commitString', ' commit: {hashVersion}', {hashVersion: __HASH_VERSION__}) : '',
    });
    submenu.push({
        label: version,
        enabled: true,
        click() {
            clipboard.writeText(version);
        },
    });

    template.push({label: 'Hel&p', submenu});
    return template;
}

export function createMenu(config: Config, updateManager: UpdateManager) {
    // TODO: Electron is enforcing certain variables that it doesn't need
    return Menu.buildFromTemplate(createTemplate(config, updateManager) as Array<MenuItemConstructorOptions | MenuItem>);
}

t('common.tabs.TAB_MESSAGING', 'Channels');
t('common.tabs.TAB_FOCALBOARD', 'Boards');
t('common.tabs.TAB_PLAYBOOKS', 'Playbooks');
