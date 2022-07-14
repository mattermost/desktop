// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, nativeImage, Tray, systemPreferences, nativeTheme} from 'electron';

import {UPDATE_TRAY} from 'common/communication';

import {localizeMessage} from 'main/i18nManager';

import WindowManager from '../windows/windowManager';
import * as AppState from '../appState';

const assetsDir = path.resolve(app.getAppPath(), 'assets');

let trayImages: Record<string, Electron.NativeImage>;
let trayIcon: Tray;
let lastStatus = 'normal';
let lastMessage = app.name;

/* istanbul ignore next */
export function refreshTrayImages(trayIconTheme: string) {
    const systemTheme = nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
    const winTheme = trayIconTheme === 'use_system' ? systemTheme : trayIconTheme;

    switch (process.platform) {
    case 'win32':
        trayImages = {
            normal: nativeImage.createFromPath(path.resolve(assetsDir, `windows/tray_${winTheme}.ico`)),
            unread: nativeImage.createFromPath(path.resolve(assetsDir, `windows/tray_${winTheme}_unread.ico`)),
            mention: nativeImage.createFromPath(path.resolve(assetsDir, `windows/tray_${winTheme}_mention.ico`)),
        };
        break;
    case 'darwin':
    {
        const osxNormal = nativeImage.createFromPath(path.resolve(assetsDir, 'osx/menuIcons/MenuIcon16Template.png'));
        const osxUnread = nativeImage.createFromPath(path.resolve(assetsDir, 'osx/menuIcons/MenuIconUnread16Template.png'));
        osxNormal.setTemplateImage(true);
        osxUnread.setTemplateImage(true);

        trayImages = {
            normal: osxNormal,
            unread: osxUnread,
            mention: osxUnread,
        };

        break;
    }
    case 'linux':
    {
        if (trayIconTheme === 'dark') {
            trayImages = {
                normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_dark_16.png')),
                unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_dark_unread_16.png')),
                mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_dark_mention_16.png')),
            };
        } else {
            //Fallback for invalid theme setting
            trayImages = {
                normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_light_16.png')),
                unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_light_unread_16.png')),
                mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_light_mention_16.png')),
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

export function setupTray(icontheme: string) {
    refreshTrayImages(icontheme);
    trayIcon = new Tray(trayImages.normal);
    if (process.platform === 'darwin') {
        systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
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
        if (anyMentions) {
            setTray('mention', localizeMessage('main.tray.tray.mention', 'You have been mentioned'));
        } else if (anyUnreads) {
            setTray('unread', localizeMessage('main.tray.tray.unread', 'You have unread channels'));
        } else if (anyExpired) {
            setTray('mention', localizeMessage('main.tray.tray.expired', 'Session Expired: Please sign in to continue receiving notifications.'));
        } else {
            setTray('normal', app.name);
        }
    });
}

function setTray(status: string, message: string) {
    if (trayIcon.isDestroyed()) {
        return;
    }

    lastStatus = status;
    lastMessage = message;
    trayIcon.setImage(trayImages[status]);
    trayIcon.setToolTip(message);
}

export function destroyTray() {
    if (trayIcon && process.platform === 'win32') {
        trayIcon.destroy();
    }
}

export function setTrayMenu(tMenu: Electron.Menu) {
    if (trayIcon) {
        trayIcon.setContextMenu(tMenu);
    }
}
