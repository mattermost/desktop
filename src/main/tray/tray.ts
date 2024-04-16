// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, nativeImage, Tray, systemPreferences, nativeTheme} from 'electron';

import AppState from 'common/appState';
import {UPDATE_APPSTATE_TOTALS} from 'common/communication';
import {Logger} from 'common/log';
import {localizeMessage} from 'main/i18nManager';
import MainWindow from 'main/windows/mainWindow';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const log = new Logger('Tray');

export class TrayIcon {
    private tray?: Tray;
    private images: Record<string, Electron.NativeImage>;
    private status: string;
    private message: string;

    constructor() {
        this.status = 'normal';
        this.message = app.name;
        this.images = {};

        AppState.on(UPDATE_APPSTATE_TOTALS, this.onAppStateUpdate);
    }

    init = (iconTheme: string) => {
        this.refreshImages(iconTheme);
        this.tray = new Tray(this.images.normal);

        if (process.platform === 'darwin') {
            systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
                this.tray?.setImage(this.images.normal);
            });
        }

        this.tray.setToolTip(app.name);
        this.tray.on('click', this.onClick);
        this.tray.on('right-click', () => this.tray?.popUpContextMenu());
        this.tray.on('balloon-click', this.onClick);
    };

    refreshImages = (trayIconTheme: string) => {
        const systemTheme = nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
        const winTheme = trayIconTheme === 'use_system' ? systemTheme : trayIconTheme;

        switch (process.platform) {
        case 'win32':
            this.images = {
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

            this.images = {
                normal: osxNormal,
                unread: osxUnread,
                mention: osxUnread,
            };

            break;
        }
        case 'linux':
        {
            if (trayIconTheme === 'dark') {
                this.images = {
                    normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_dark_16.png')),
                    unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_dark_unread_16.png')),
                    mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_dark_mention_16.png')),
                };
            } else {
                //Fallback for invalid theme setting
                this.images = {
                    normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_light_16.png')),
                    unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_light_unread_16.png')),
                    mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'top_bar_light_mention_16.png')),
                };
            }
            break;
        }
        default:
            this.images = {};
        }
        if (this.tray) {
            this.update(this.status, this.message);
        }
        return this.images;
    };

    destroy = () => {
        if (process.platform === 'win32') {
            this.tray?.destroy();
        }
    };

    setMenu = (tMenu: Electron.Menu) => this.tray?.setContextMenu(tMenu);

    private update = (status: string, message: string) => {
        if (!this.tray || this.tray.isDestroyed()) {
            return;
        }

        this.status = status;
        this.message = message;
        this.tray.setImage(this.images[status]);
        this.tray.setToolTip(message);
    };

    // Linux note: the click event was fixed in Electron v23, but only fires when the OS supports StatusIconLinuxDbus
    // There is a fallback case that will make sure the icon is displayed, but will only support the context menu
    // See here: https://github.com/electron/electron/pull/36333
    private onClick = () => {
        log.verbose('onClick');

        // Special case for macOS since that's how most tray icons behave there
        if (process.platform === 'darwin') {
            this.tray?.popUpContextMenu();
            return;
        }

        // At minimum show the main window
        MainWindow.show();

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            throw new Error('Main window does not exist');
        }

        // Restore if minimized
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
            mainWindow.show();
        }

        mainWindow.focus();
    };

    private onAppStateUpdate = (anyExpired: boolean, anyMentions: number, anyUnreads: boolean) => {
        if (anyMentions > 0) {
            this.update('mention', localizeMessage('main.tray.tray.mention', 'You have been mentioned'));
        } else if (anyUnreads) {
            this.update('unread', localizeMessage('main.tray.tray.unread', 'You have unread channels'));
        } else if (anyExpired) {
            this.update('mention', localizeMessage('main.tray.tray.expired', 'Session Expired: Please sign in to continue receiving notifications.'));
        } else {
            this.update('normal', app.name);
        }
    };
}

const tray = new TrayIcon();
export default tray;
