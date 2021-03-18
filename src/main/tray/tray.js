// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import {app, nativeImage, nativeTheme, Tray, systemPreferences} from 'electron';

import {UPDATE_TRAY} from 'common/communication';

import * as WindowManager from '../windows/windowManager';
import * as AppState from '../appState';

const assetsDir = path.resolve(app.getAppPath(), 'assets');

let trayImages;
let trayIcon;
let lastStatus = 'normal';
let lastMessage = app.name;

export function refreshTrayImages(trayIconTheme) {
    switch (process.platform) {
    case 'win32':
        trayImages = {
            normal: nativeImage.createFromPath(path.resolve(assetsDir, 'windows/tray.ico')),
            unread: nativeImage.createFromPath(path.resolve(assetsDir, 'windows/tray_unread.ico')),
            mention: nativeImage.createFromPath(path.resolve(assetsDir, 'windows/tray_mention.ico')),
        };
        break;
    case 'darwin':
    {
        trayImages = {
            light: {
                normal: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/MenuIcon.png')),
                unread: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/MenuIconUnread.png')),
                mention: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/MenuIconMention.png')),
            },
            clicked: {
                normal: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/ClickedMenuIcon.png')),
                unread: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/ClickedMenuIconUnread.png')),
                mention: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/ClickedMenuIconMention.png')),
            },
        };
        switchMenuIconImages(trayImages, nativeTheme.shouldUseDarkColors);
        break;
    }
    case 'linux':
    {
        const theme = trayIconTheme;
        try {
            trayImages = {
                normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', theme, 'MenuIconTemplate.png')),
                unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', theme, 'MenuIconUnreadTemplate.png')),
                mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', theme, 'MenuIconMentionTemplate.png')),
            };
        } catch (e) {
            //Fallback for invalid theme setting
            trayImages = {
                normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'light', 'MenuIconTemplate.png')),
                unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'light', 'MenuIconUnreadTemplate.png')),
                mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'light', 'MenuIconMentionTemplate.png')),
            };
        }
        break;
    }
    default:
        trayImages = {};
    }
    if (trayIcon) {
        setTray(lastStatus, lastMessage);
    }
    return trayImages;
}

export function switchMenuIconImages(icons, isDarkMode) {
    if (isDarkMode) {
        icons.normal = icons.clicked.normal;
        icons.unread = icons.clicked.unread;
        icons.mention = icons.clicked.mention;
    } else {
        icons.normal = icons.light.normal;
        icons.unread = icons.light.unread;
        icons.mention = icons.light.mention;
    }
}

export function setupTray(icontheme) {
    refreshTrayImages(icontheme);
    trayIcon = new Tray(trayImages.normal);
    if (process.platform === 'darwin') {
        trayIcon.setPressedImage(trayImages.clicked.normal);
        systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
            switchMenuIconImages(trayImages, nativeTheme.shouldUseDarkColors);
            trayIcon.setImage(trayImages.normal);
        });
    }

    trayIcon.setToolTip(app.name);
    trayIcon.on('click', () => {
        WindowManager.restoreMain();
    });

    trayIcon.on('right-click', () => {
        trayIcon.popUpContextMenu();
    });
    trayIcon.on('balloon-click', () => {
        WindowManager.restoreMain();
    });

    AppState.on(UPDATE_TRAY, (anyExpired, anyMentions, anyUnreads) => {
        if (anyExpired) {
            setTray('mention', 'Session Expired: Please sign in to continue receiving notifications.');
        } else if (anyMentions) {
            setTray('mention', 'You have been mentioned');
        } else if (anyUnreads) {
            setTray('unread', 'You have unread channels');
        } else {
            setTray('normal', app.name);
        }
    });
}

function setTray(status, message) {
    lastStatus = status;
    lastMessage = message;
    trayIcon.setImage(trayImages[status]);
    if (process.platform === 'darwin') {
        trayIcon.setPressedImage(trayImages.clicked[status]);
    }
    trayIcon.setToolTip(message);
}

export function destroyTray() {
    if (trayIcon && process.platform === 'win32') {
        trayIcon.destroy();
    }
}

export function setTrayMenu(tMenu, mainWindow) {
    if (process.platform === 'darwin' || process.platform === 'linux') {
    // store the information, if the tray was initialized, for checking in the settings, if the application
    // was restarted after setting "Show icon on menu bar"
        if (trayIcon) {
            trayIcon.setContextMenu(tMenu);
            mainWindow.trayWasVisible = true;
        } else {
            mainWindow.trayWasVisible = false;
        }
    } else if (trayIcon) {
        trayIcon.setContextMenu(tMenu);
    }
}
