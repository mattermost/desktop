// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app, ipcMain, Menu, MenuItemConstructorOptions, MenuItem, session, shell, WebContents, clipboard} from 'electron';

import {BROWSER_HISTORY_BUTTON, OPEN_TEAMS_DROPDOWN, SHOW_NEW_SERVER_MODAL} from 'common/communication';
import {t} from 'common/utils/util';
import {getTabDisplayName, TabType} from 'common/tabs/TabView';
import {Config} from 'common/config';

import {localizeMessage} from 'main/i18nManager';
import WindowManager from 'main/windows/windowManager';
import {UpdateManager} from 'main/autoUpdater';

export function createTemplate(config: Config, updateManager: UpdateManager) {
    const separatorItem: MenuItemConstructorOptions = {
        type: 'separator',
    };

    const isMac = process.platform === 'darwin';
    const appName = app.name;
    const firstMenuName = isMac ? '&' + appName : localizeMessage('main.menus.app.file', '&File');
    const template = [];

    const settingsLabel = isMac ? localizeMessage('main.menus.app.file.preferences', 'Preferences...') : localizeMessage('main.menus.app.file.settings', 'Settings...');

    let platformAppMenu = [];
    if (isMac) {
        platformAppMenu.push(
            {
                label: localizeMessage('main.menus.app.file.about', 'About {appName}', {appName}),
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
            label: localizeMessage('main.menus.app.file.signInToAnotherServer', 'Sign in to Another Server'),
            click() {
                ipcMain.emit(SHOW_NEW_SERVER_MODAL);
            },
        });
    }

    if (isMac) {
        platformAppMenu = platformAppMenu.concat([
            separatorItem, {
                role: 'hide',
                label: localizeMessage('main.menus.app.file.hide', 'Hide {appName}', {appName}),
            }, {
                role: 'hideOthers',
                label: localizeMessage('main.menus.app.file.hideOthers', 'Hide Others'),
            }, {
                role: 'unhide',
                label: localizeMessage('main.menus.app.file.unhide', 'Show All'),
            }, separatorItem, {
                role: 'quit',
                label: localizeMessage('main.menus.app.file.quit', 'Quit {appName}', {appName}),
            }]);
    } else {
        platformAppMenu = platformAppMenu.concat([
            separatorItem, {
                role: 'quit',
                label: localizeMessage('main.menus.app.file.exit', 'Exit'),
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
        label: localizeMessage('main.menus.app.edit', '&Edit'),
        submenu: [{
            role: 'undo',
            label: localizeMessage('main.menus.app.edit.undo', 'Undo'),
            accelerator: 'CmdOrCtrl+Z',
        }, {
            role: 'Redo',
            label: localizeMessage('main.menus.app.edit.redo', 'Redo'),
            accelerator: 'CmdOrCtrl+SHIFT+Z',
        }, separatorItem, {
            role: 'cut',
            label: localizeMessage('main.menus.app.edit.cut', 'Cut'),
            accelerator: 'CmdOrCtrl+X',
        }, {
            role: 'copy',
            label: localizeMessage('main.menus.app.edit.copy', 'Copy'),
            accelerator: 'CmdOrCtrl+C',
        }, {
            role: 'paste',
            label: localizeMessage('main.menus.app.edit.paste', 'Paste'),
            accelerator: 'CmdOrCtrl+V',
        }, {
            role: 'pasteAndMatchStyle',
            label: localizeMessage('main.menus.app.edit.pasteAndMatchStyle', 'Paste and Match Style'),
            accelerator: 'CmdOrCtrl+SHIFT+V',
        }, {
            role: 'selectall',
            label: localizeMessage('main.menus.app.edit.selectAll', 'Select All'),
            accelerator: 'CmdOrCtrl+A',
        }],
    });

    const viewSubMenu = [{
        label: localizeMessage('main.menus.app.view.find', 'Find..'),
        accelerator: 'CmdOrCtrl+F',
        click() {
            WindowManager.sendToFind();
        },
    }, {
        label: localizeMessage('main.menus.app.view.reload', 'Reload'),
        accelerator: 'CmdOrCtrl+R',
        click() {
            WindowManager.reload();
        },
    }, {
        label: localizeMessage('main.menus.app.view.clearCacheAndReload', 'Clear Cache and Reload'),
        accelerator: 'Shift+CmdOrCtrl+R',
        click() {
            session.defaultSession.clearCache();
            WindowManager.reload();
        },
    }, {
        role: 'togglefullscreen',
        label: localizeMessage('main.menus.app.view.fullscreen', 'Toggle Full Screen'),
        accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
    }, separatorItem, {
        label: localizeMessage('main.menus.app.view.actualSize', 'Actual Size'),
        role: 'resetZoom',
        accelerator: 'CmdOrCtrl+0',
    }, {
        role: 'zoomIn',
        label: localizeMessage('main.menus.app.view.zoomIn', 'Zoom In'),
        accelerator: 'CmdOrCtrl+=',
    }, {
        role: 'zoomIn',
        visible: false,
        accelerator: 'CmdOrCtrl+Shift+=',
    }, {
        role: 'zoomOut',
        label: localizeMessage('main.menus.app.view.zoomOut', 'Zoom Out'),
        accelerator: 'CmdOrCtrl+-',
    }, {
        role: 'zoomOut',
        visible: false,
        accelerator: 'CmdOrCtrl+Shift+-',
    }, separatorItem, {
        label: localizeMessage('main.menus.app.view.devToolsAppWrapper', 'Developer Tools for Application Wrapper'),
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
        label: localizeMessage('main.menus.app.view.devToolsCurrentServer', 'Developer Tools for Current Server'),
        click() {
            WindowManager.openBrowserViewDevTools();
        },
    }];

    if (process.platform !== 'darwin' && process.platform !== 'win32') {
        viewSubMenu.push(separatorItem);
        viewSubMenu.push({
            label: localizeMessage('main.menus.app.view.toggleDarkMode', 'Toggle Dark Mode'),
            click() {
                config.toggleDarkModeManually();
            },
        });
    }

    template.push({
        label: localizeMessage('main.menus.app.view', '&View'),
        submenu: viewSubMenu,
    });
    template.push({
        label: localizeMessage('main.menus.app.history', '&History'),
        submenu: [{
            label: localizeMessage('main.menus.app.history.back', 'Back'),
            accelerator: process.platform === 'darwin' ? 'Cmd+[' : 'Alt+Left',
            click: () => {
                const view = WindowManager.viewManager?.getCurrentView();
                if (view && view.view.webContents.canGoBack() && !view.isAtRoot) {
                    view.view.webContents.goBack();
                    ipcMain.emit(BROWSER_HISTORY_BUTTON, null, view.name);
                }
            },
        }, {
            label: localizeMessage('main.menus.app.history.forward', 'Forward'),
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
        label: localizeMessage('main.menus.app.window', '&Window'),
        role: isMac ? 'windowMenu' : null,
        submenu: [{
            role: 'minimize',
            label: localizeMessage('main.menus.app.window.minimize', 'Minimize'),

            // empty string removes shortcut on Windows; null will default by OS
            accelerator: process.platform === 'win32' ? '' : null,
        }, ...(isMac ? [{
            role: 'zoom',
            label: localizeMessage('main.menus.app.window.zoom', 'Zoom'),
        }, separatorItem,
        ] : []), {
            role: 'close',
            label: isMac ? localizeMessage('main.menus.app.window.closeWindow', 'Close Window') : localizeMessage('main.menus.app.window.close', 'Close'),
            accelerator: 'CmdOrCtrl+W',
        }, separatorItem, {
            label: localizeMessage('main.menus.app.window.showServers', 'Show Servers'),
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
                        label: `    ${localizeMessage(`common.tabs.${tab.name}`, getTabDisplayName(tab.name as TabType))}`,
                        accelerator: `CmdOrCtrl+${i + 1}`,
                        click() {
                            WindowManager.switchTab(team.name, tab.name);
                        },
                    });
                });
            }
            return items;
        }).flat(), separatorItem, {
            label: localizeMessage('main.menus.app.window.selectNextTab', 'Select Next Tab'),
            accelerator: 'Ctrl+Tab',
            click() {
                WindowManager.selectNextTab();
            },
            enabled: (teams.length > 1),
        }, {
            label: localizeMessage('main.menus.app.window.selectPreviousTab', 'Select Previous Tab'),
            accelerator: 'Ctrl+Shift+Tab',
            click() {
                WindowManager.selectPreviousTab();
            },
            enabled: (teams.length > 1),
        }, ...(isMac ? [separatorItem, {
            role: 'front',
            label: localizeMessage('main.menus.app.window.bringAllToFront', 'Bring All to Front'),
        }] : []),
        ],
    };
    template.push(windowMenu);
    const submenu = [];
    if (updateManager && config.canUpgrade) {
        if (updateManager.versionDownloaded) {
            submenu.push({
                label: localizeMessage('main.menus.app.help.restartAndUpdate', 'Restart and Update'),
                click() {
                    updateManager.handleUpdate();
                },
            });
        } else if (updateManager.versionAvailable) {
            submenu.push({
                label: localizeMessage('main.menus.app.help.downloadUpdate', 'Download Update'),
                click() {
                    updateManager.handleDownload();
                },
            });
        } else {
            submenu.push({
                label: localizeMessage('main.menus.app.help.checkForUpdates', 'Check for Updates'),
                click() {
                    updateManager.checkForUpdates(true);
                },
            });
        }
    }
    if (config.data?.helpLink) {
        submenu.push({
            label: localizeMessage('main.menus.app.help.learnMore', 'Learn More...'),
            click() {
                shell.openExternal(config.data!.helpLink);
            },
        });
        submenu.push(separatorItem);
    }

    const version = localizeMessage('main.menus.app.help.versionString', 'Version {version}{commit}', {
        version: app.getVersion(),
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        commit: __HASH_VERSION__ ? localizeMessage('main.menus.app.help.commitString', ' commit: {hashVersion}', {hashVersion: __HASH_VERSION__}) : '',
    });
    submenu.push({
        label: version,
        enabled: true,
        click() {
            clipboard.writeText(version);
        },
    });

    template.push({label: localizeMessage('main.menus.app.help', 'Hel&p'), submenu});
    return template;
}

export function createMenu(config: Config, updateManager: UpdateManager) {
    // TODO: Electron is enforcing certain variables that it doesn't need
    return Menu.buildFromTemplate(createTemplate(config, updateManager) as Array<MenuItemConstructorOptions | MenuItem>);
}

t('common.tabs.TAB_MESSAGING');
t('common.tabs.TAB_FOCALBOARD');
t('common.tabs.TAB_PLAYBOOKS');
