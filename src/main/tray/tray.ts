// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, nativeImage, Tray, systemPreferences, nativeTheme} from 'electron';

import AppState from 'common/appState';
import {UPDATE_APPSTATE_TOTALS} from 'common/communication';
import {Logger} from 'common/log';

import {localizeMessage} from 'main/i18nManager';
import MainWindow from 'main/windows/mainWindow';
import SettingsWindow from 'main/windows/settingsWindow';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const log = new Logger('Tray');

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

export function setupTray(iconTheme: string) {
    refreshTrayImages(iconTheme);
    trayIcon = new Tray(trayImages.normal);
    if (process.platform === 'darwin') {
        systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
            trayIcon.setImage(trayImages.normal);
        });
    }

    trayIcon.setToolTip(app.name);
    trayIcon.on('click', () => {
        const mainWindow = MainWindow.get();
        if (mainWindow && mainWindow.isVisible()) {
            mainWindow.blur(); // To move focus to the next top-level window in Windows
            mainWindow.hide();
        } else {
            restoreMain();
        }
    });

    trayIcon.on('right-click', () => {
        trayIcon.popUpContextMenu();
    });
    trayIcon.on('balloon-click', () => {
        restoreMain();
    });

    AppState.on(UPDATE_APPSTATE_TOTALS, (anyExpired: boolean, anyMentions: number, anyUnreads: boolean) => {
        if (anyMentions > 0) {
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

const restoreMain = () => {
    log.info('restoreMain');
    MainWindow.show();
    const mainWindow = MainWindow.get();
    if (!mainWindow) {
        throw new Error('Main window does not exist');
    }
    if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        } else {
            mainWindow.show();
        }
        const settingsWindow = SettingsWindow.get();
        if (settingsWindow) {
            settingsWindow.focus();
        } else {
            mainWindow.focus();
        }
    } else if (SettingsWindow.get()) {
        SettingsWindow.get()?.focus();
    } else {
        mainWindow.focus();
    }
};

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
