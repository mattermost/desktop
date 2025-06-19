// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import type {MenuItemConstructorOptions, MenuItem} from 'electron';
import {app, ipcMain, Menu, session, shell, clipboard} from 'electron';
import log from 'electron-log';

import ServerViewState from 'app/serverViewState';
import {OPEN_SERVERS_DROPDOWN, SHOW_NEW_SERVER_MODAL} from 'common/communication';
import type {Config} from 'common/config';
import {DEFAULT_EE_REPORT_PROBLEM_LINK, DEFAULT_TE_REPORT_PROBLEM_LINK, ModalConstants} from 'common/constants';
import ServerManager from 'common/servers/serverManager';
import {t} from 'common/utils/util';
import {getViewDisplayName} from 'common/views/View';
import type {ViewType} from 'common/views/View';
import {clearAllData, clearDataForServer} from 'main/app/utils';
import type {UpdateManager} from 'main/autoUpdater';
import DeveloperMode from 'main/developerMode';
import Diagnostics from 'main/diagnostics';
import downloadsManager from 'main/downloadsManager';
import {localizeMessage} from 'main/i18nManager';
import {getLocalPreload} from 'main/utils';
import ModalManager from 'main/views/modalManager';
import ViewManager from 'main/views/viewManager';
import CallsWidgetWindow from 'main/windows/callsWidgetWindow';
import MainWindow from 'main/windows/mainWindow';

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
    });

    if (config.enableServerManagement === true && ServerManager.hasServers()) {
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
        id: 'file',
        label: firstMenuName,
        submenu: [
            ...platformAppMenu,
        ],
    });
    template.push({
        id: 'edit',
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

    const devToolsSubMenu: Electron.MenuItemConstructorOptions[] = [
        {
            label: localizeMessage('main.menus.app.view.devToolsAppWrapper', 'Developer Tools for Application Wrapper'),
            accelerator: (() => {
                if (process.platform === 'darwin') {
                    return 'Alt+Command+I';
                }
                return 'Ctrl+Shift+I';
            })(),
            click() {
                const mainWindow = MainWindow.get();
                if (!mainWindow) {
                    return;
                }

                if (mainWindow.webContents.isDevToolsOpened()) {
                    mainWindow.webContents.closeDevTools();
                } else {
                    mainWindow.webContents.openDevTools({mode: 'detach'});
                }
            },
        },
        {
            label: localizeMessage('main.menus.app.view.devToolsCurrentServer', 'Developer Tools for Current Server'),
            click() {
                ViewManager.getCurrentView()?.openDevTools();
            },
        },
    ];

    if (CallsWidgetWindow.isOpen()) {
        devToolsSubMenu.push({
            label: localizeMessage('main.menus.app.view.devToolsCurrentCallWidget', 'Developer Tools for Call Widget'),
            click() {
                CallsWidgetWindow.openDevTools();
            },
        });

        if (CallsWidgetWindow.isPopoutOpen()) {
            devToolsSubMenu.push({
                label: localizeMessage('main.menus.app.view.devToolsCurrentCallWidgetPopout', 'Developer Tools for Call Widget Popout'),
                click() {
                    CallsWidgetWindow.openPopoutDevTools();
                },
            });
        }
    }

    if (DeveloperMode.enabled()) {
        devToolsSubMenu.push(...[
            separatorItem,
            {
                label: localizeMessage('main.menus.app.view.developerModeBrowserOnly', 'Browser Only Mode'),
                type: 'checkbox' as const,
                checked: DeveloperMode.get('browserOnly'),
                click() {
                    DeveloperMode.toggle('browserOnly');
                },
            },
            {
                label: localizeMessage('main.menus.app.view.developerModeDisableNotificationStorage', 'Disable Notification Storage'),
                type: 'checkbox' as const,
                checked: DeveloperMode.get('disableNotificationStorage'),
                click() {
                    DeveloperMode.toggle('disableNotificationStorage');
                },
            },
            {
                label: localizeMessage('main.menus.app.view.developerModeDisableUserActivityMonitor', 'Disable User Activity Monitor'),
                type: 'checkbox' as const,
                checked: DeveloperMode.get('disableUserActivityMonitor'),
                click() {
                    DeveloperMode.toggle('disableUserActivityMonitor');
                },
            },
            {
                label: localizeMessage('main.menus.app.view.developerModeDisableContextMenu', 'Disable Context Menu'),
                type: 'checkbox' as const,
                checked: DeveloperMode.get('disableContextMenu'),
                click() {
                    DeveloperMode.toggle('disableContextMenu');
                },
            },
        ]);
    }

    const viewSubMenu: Electron.MenuItemConstructorOptions[] = [{
        label: localizeMessage('main.menus.app.view.find', 'Find..'),
        accelerator: 'CmdOrCtrl+F',
        click() {
            ViewManager.sendToFind();
        },
    }, {
        label: localizeMessage('main.menus.app.view.reload', 'Reload'),
        accelerator: 'CmdOrCtrl+R',
        click() {
            ViewManager.reload();
        },
    }, {
        label: localizeMessage('main.menus.app.view.clearCacheAndReload', 'Clear Cache and Reload'),
        accelerator: 'Shift+CmdOrCtrl+R',
        click() {
            session.defaultSession.clearCache();
            ViewManager.reload();
        },
    }];

    if (process.platform !== 'linux') {
        viewSubMenu.push({
            role: 'togglefullscreen',
            label: localizeMessage('main.menus.app.view.fullscreen', 'Toggle Full Screen'),
            accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
        });
    }

    viewSubMenu.push(separatorItem, {
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
        role: 'zoomIn',
        visible: false,
        accelerator: 'CmdOrCtrl+Plus',
    }, {
        role: 'zoomOut',
        label: localizeMessage('main.menus.app.view.zoomOut', 'Zoom Out'),
        accelerator: 'CmdOrCtrl+-',
    }, {
        role: 'zoomOut',
        visible: false,
        accelerator: 'CmdOrCtrl+Shift+-',
    }, separatorItem, {
        id: 'app-menu-downloads',
        label: localizeMessage('main.menus.app.view.downloads', 'Downloads'),
        enabled: downloadsManager.hasDownloads(),
        click() {
            return downloadsManager.openDownloadsDropdown();
        },
    }, separatorItem, {
        id: 'clear-data-for-server',
        label: localizeMessage('main.menus.app.view.clearDataForServer', 'Clear Data for Current Server'),
        async click() {
            return clearDataForServer(ServerViewState.getCurrentServer());
        },
    }, {
        id: 'clear-data',
        label: localizeMessage('main.menus.app.view.clearAllData', 'Clear All Data'),
        async click() {
            return clearAllData();
        },
    }, separatorItem, {
        label: localizeMessage('main.menus.app.view.devToolsSubMenu', 'Developer Tools'),
        submenu: devToolsSubMenu,
    });

    if (process.platform !== 'darwin' && process.platform !== 'win32') {
        viewSubMenu.push(separatorItem);
        viewSubMenu.push({
            label: localizeMessage('main.menus.app.view.toggleDarkMode', 'Toggle Dark Mode'),
            click() {
                config.set('darkMode', !config.darkMode);
            },
        });
    }

    template.push({
        id: 'view',
        label: localizeMessage('main.menus.app.view', '&View'),
        submenu: viewSubMenu,
    });
    template.push({
        id: 'history',
        label: localizeMessage('main.menus.app.history', '&History'),
        submenu: [{
            label: localizeMessage('main.menus.app.history.back', 'Back'),
            accelerator: process.platform === 'darwin' ? 'Cmd+[' : 'Alt+Left',
            click: () => {
                ViewManager.getCurrentView()?.goToOffset(-1);
            },
        }, {
            label: localizeMessage('main.menus.app.history.forward', 'Forward'),
            accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
            click: () => {
                ViewManager.getCurrentView()?.goToOffset(1);
            },
        }],
    });

    const servers = ServerManager.getOrderedServers();
    const currentServer = ServerManager.hasServers() ? ServerViewState.getCurrentServer() : undefined;
    const windowMenu = {
        id: 'window',
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
        }, separatorItem,
        ...(ServerManager.hasServers() ? [{
            label: localizeMessage('main.menus.app.window.showServers', 'Show Servers'),
            accelerator: `${process.platform === 'darwin' ? 'Cmd+Ctrl' : 'Ctrl+Shift'}+S`,
            click() {
                ipcMain.emit(OPEN_SERVERS_DROPDOWN);
            },
        }] : []),
        ...servers.slice(0, 9).map((server, i) => {
            const items = [];
            items.push({
                label: server.name,
                accelerator: `${process.platform === 'darwin' ? 'Cmd+Ctrl' : 'Ctrl+Shift'}+${i + 1}`,
                click() {
                    ServerViewState.switchServer(server.id);
                },
            });
            if (currentServer?.id === server.id) {
                ServerManager.getOrderedTabsForServer(server.id).slice(0, 9).forEach((view, i) => {
                    items.push({
                        label: `    ${localizeMessage(`common.views.${view.type}`, getViewDisplayName(view.type as ViewType))}`,
                        accelerator: `CmdOrCtrl+${i + 1}`,
                        click() {
                            ViewManager.showById(view.id);
                        },
                    });
                });
            }
            return items;
        }).flat(), separatorItem, {
            label: localizeMessage('main.menus.app.window.selectNextTab', 'Select Next Tab'),
            accelerator: 'Ctrl+Tab',
            click() {
                ServerViewState.selectNextView();
            },
            enabled: (servers.length > 1),
        }, {
            label: localizeMessage('main.menus.app.window.selectPreviousTab', 'Select Previous Tab'),
            accelerator: 'Ctrl+Shift+Tab',
            click() {
                ServerViewState.selectPreviousView();
            },
            enabled: (servers.length > 1),
        }, ...(isMac ? [separatorItem, {
            role: 'front',
            label: localizeMessage('main.menus.app.window.bringAllToFront', 'Bring All to Front'),
        }] : []),
        ],
    };
    template.push(windowMenu);

    const currentRemoteInfo = currentServer ? ServerManager.getRemoteInfo(currentServer.id) : undefined;
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
        submenu.push(separatorItem);
    }

    const helpLink = currentRemoteInfo?.helpLink ?? config.helpLink;
    if (helpLink) {
        submenu.push({
            label: localizeMessage('main.menus.app.help.userGuide', 'User guide'),
            click() {
                shell.openExternal(helpLink);
            },
        });
    }
    const academyLink = config.academyLink;
    if (academyLink) {
        submenu.push({
            label: localizeMessage('main.menus.app.help.academy', 'Mattermost Academy'),
            click() {
                shell.openExternal(academyLink);
            },
        });
    }
    submenu.push(separatorItem);

    submenu.push({
        id: 'Show logs',
        label: localizeMessage('main.menus.app.help.ShowLogs', 'Show logs'),
        click() {
            shell.showItemInFolder(log.transports.file.getFile().path);
        },
    });

    submenu.push({
        id: 'diagnostics',
        label: localizeMessage('main.menus.app.help.RunDiagnostics', 'Run diagnostics'),
        click() {
            Diagnostics.run();
        },
    });

    let reportProblemLink = currentRemoteInfo?.reportProblemLink;
    if (!reportProblemLink) {
        switch (currentRemoteInfo?.licenseSku) {
        case 'enterprise':
        case 'professional':
            reportProblemLink = DEFAULT_EE_REPORT_PROBLEM_LINK;
            break;
        default:
            reportProblemLink = DEFAULT_TE_REPORT_PROBLEM_LINK;
            break;
        }
    }
    if (reportProblemLink) {
        submenu.push({
            label: localizeMessage('main.menus.app.help.reportProblem', 'Report a problem'),
            click() {
                shell.openExternal(reportProblemLink!);
            },
        });
    }
    submenu.push(separatorItem);

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

    template.push({id: 'help', label: localizeMessage('main.menus.app.help', 'Hel&p'), submenu});
    return template;
}

export function createMenu(config: Config, updateManager: UpdateManager) {
    // TODO: Electron is enforcing certain variables that it doesn't need
    return Menu.buildFromTemplate(createTemplate(config, updateManager) as Array<MenuItemConstructorOptions | MenuItem>);
}

t('common.tabs.TAB_MESSAGING');
t('common.tabs.TAB_FOCALBOARD');
t('common.tabs.TAB_PLAYBOOKS');
