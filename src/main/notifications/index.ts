// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, shell, Notification, ipcMain} from 'electron';
import isDev from 'electron-is-dev';
import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import {PLAY_SOUND, NOTIFICATION_CLICKED, BROWSER_HISTORY_PUSH, OPEN_NOTIFICATION_PREFERENCES} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import DeveloperMode from 'main/developerMode';

import getLinuxDoNotDisturb from './dnd-linux';
import getWindowsDoNotDisturb from './dnd-windows';
import {DownloadNotification} from './Download';
import {Mention} from './Mention';
import {NewVersionNotification, UpgradeNotification} from './Upgrade';

import PermissionsManager from '../permissionsManager';
import ViewManager from '../views/viewManager';
import MainWindow from '../windows/mainWindow';

const log = new Logger('Notifications');

class NotificationManager {
    private mentionsPerChannel?: Map<string, Mention>;
    private allActiveNotifications?: Map<string, Notification>;
    private upgradeNotification?: NewVersionNotification;
    private restartToUpgradeNotification?: UpgradeNotification;

    constructor() {
        ipcMain.on(OPEN_NOTIFICATION_PREFERENCES, this.openNotificationPreferences);

        DeveloperMode.switchOff('disableNotificationStorage', () => {
            this.mentionsPerChannel = new Map();
            this.allActiveNotifications = new Map();
        }, () => {
            this.mentionsPerChannel?.clear();
            delete this.mentionsPerChannel;
            this.allActiveNotifications?.clear();
            delete this.allActiveNotifications;
        });
    }

    public async displayMention(title: string, body: string, channelId: string, teamId: string, url: string, silent: boolean, webcontents: Electron.WebContents, soundName: string) {
        log.debug('displayMention', {channelId, teamId, url, silent, soundName});

        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return {status: 'error', reason: 'notification_api', data: 'notification not supported'};
        }

        if (await getDoNotDisturb()) {
            log.debug('do not disturb is on, will not send');
            return {status: 'not_sent', reason: 'os_dnd'};
        }

        const view = ViewManager.getViewByWebContentsId(webcontents.id);
        if (!view) {
            log.error('missing view', webcontents.id);
            return {status: 'error', reason: 'missing_view'};
        }
        const serverName = view.view.server.name;
        if (!view.view.shouldNotify) {
            log.debug('should not notify for this view', webcontents.id);
            return {status: 'not_sent', reason: 'view_should_not_notify'};
        }

        const options = {
            title: `${serverName}: ${title}`,
            body,
            silent,
            soundName,
        };

        if (!await PermissionsManager.doPermissionRequest(webcontents.id, 'notifications', {requestingUrl: view.view.server.url.toString(), isMainFrame: false})) {
            log.verbose('permissions disallowed', webcontents.id, serverName, view.view.server.url.toString());
            return {status: 'not_sent', reason: 'notifications_permission_disallowed'};
        }

        const mention = new Mention(options, channelId, teamId);
        this.allActiveNotifications?.set(mention.uId, mention);

        mention.on('click', () => {
            log.debug('notification click', serverName, mention.uId);

            this.allActiveNotifications?.delete(mention.uId);

            // Show the window after navigation has finished to avoid the focus handler
            // being called before the current channel has updated
            const focus = () => {
                MainWindow.show();
                ViewManager.showById(view.id);
                ipcMain.off(BROWSER_HISTORY_PUSH, focus);
            };
            ipcMain.on(BROWSER_HISTORY_PUSH, focus);
            webcontents.send(NOTIFICATION_CLICKED, channelId, teamId, url);
        });

        mention.on('close', () => {
            this.allActiveNotifications?.delete(mention.uId);
        });

        return new Promise((resolve) => {
            // If mention never shows somehow, resolve the promise after 10s
            const timeout = setTimeout(() => {
                log.debug('notification timeout', serverName, mention.uId);
                resolve({status: 'error', reason: 'notification_timeout'});
            }, 10000);
            let failed = false;

            mention.on('show', () => {
                // Ensure the failed event isn't also called, if it is we should resolve using its method
                setTimeout(() => {
                    if (!failed) {
                        log.debug('displayMention.show', serverName, mention.uId);

                        // On Windows, manually dismiss notifications from the same channel and only show the latest one
                        if (process.platform === 'win32') {
                            const mentionKey = `${mention.teamId}:${mention.channelId}`;
                            if (this.mentionsPerChannel?.has(mentionKey)) {
                                log.debug(`close ${mentionKey}`);
                                this.mentionsPerChannel?.get(mentionKey)?.close();
                                this.mentionsPerChannel?.delete(mentionKey);
                            }
                            this.mentionsPerChannel?.set(mentionKey, mention);
                        }
                        const notificationSound = mention.getNotificationSound();
                        if (notificationSound) {
                            MainWindow.sendToRenderer(PLAY_SOUND, notificationSound);
                        }
                        flashFrame(true);
                        clearTimeout(timeout);
                        resolve({status: 'success'});
                    }
                }, 0);
            });

            mention.on('failed', (_, error) => {
                failed = true;
                this.allActiveNotifications?.delete(mention.uId);
                clearTimeout(timeout);

                // Special case for Windows - means that notifications are disabled at the OS level
                if (error.includes('HRESULT:-2143420143')) {
                    log.warn('notifications disabled in Windows settings');
                    resolve({status: 'not_sent', reason: 'windows_permissions_denied'});
                } else {
                    log.error('notification failed to show', serverName, mention.uId, error);
                    resolve({status: 'error', reason: 'electron_notification_failed', data: error});
                }
            });
            mention.show();
        });
    }

    public async displayDownloadCompleted(fileName: string, path: string, serverName: string) {
        log.debug('displayDownloadCompleted', {fileName, path, serverName});

        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return;
        }

        if (await getDoNotDisturb()) {
            return;
        }

        const download = new DownloadNotification(fileName, serverName);
        this.allActiveNotifications?.set(download.uId, download);

        download.on('show', () => {
            flashFrame(true);
        });

        download.on('click', () => {
            shell.showItemInFolder(path.normalize());
            this.allActiveNotifications?.delete(download.uId);
        });

        download.on('close', () => {
            this.allActiveNotifications?.delete(download.uId);
        });

        download.on('failed', () => {
            this.allActiveNotifications?.delete(download.uId);
        });
        download.show();
    }

    public async displayUpgrade(version: string, handleUpgrade: () => void) {
        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return;
        }
        if (await getDoNotDisturb()) {
            return;
        }

        if (this.upgradeNotification) {
            this.upgradeNotification.close();
        }
        this.upgradeNotification = new NewVersionNotification();
        this.upgradeNotification.on('click', () => {
            log.info(`User clicked to upgrade to ${version}`);
            handleUpgrade();
        });
        this.upgradeNotification.show();
    }

    public async displayRestartToUpgrade(version: string, handleUpgrade: () => void) {
        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return;
        }
        if (await getDoNotDisturb()) {
            return;
        }

        this.restartToUpgradeNotification = new UpgradeNotification();
        this.restartToUpgradeNotification.on('click', () => {
            log.info(`User requested perform the upgrade now to ${version}`);
            handleUpgrade();
        });
        this.restartToUpgradeNotification.show();
    }

    private openNotificationPreferences() {
        switch (process.platform) {
        case 'darwin':
            shell.openExternal('x-apple.systempreferences:com.apple.preference.notifications?Notifications');
            break;
        case 'win32':
            shell.openExternal('ms-settings:notifications');
            break;
        }
    }
}

export async function getDoNotDisturb() {
    if (process.platform === 'win32') {
        return getWindowsDoNotDisturb();
    }

    // We have to turn this off for dev mode because the Electron binary doesn't have the focus center API entitlement
    if (process.platform === 'darwin' && !isDev) {
        try {
            const dnd = await getDarwinDoNotDisturb();
            return dnd;
        } catch (e) {
            log.warn('macOS DND check threw an error', e);
            return false;
        }
    }

    if (process.platform === 'linux') {
        return getLinuxDoNotDisturb();
    }

    return false;
}

function flashFrame(flash: boolean) {
    if (process.platform === 'linux' || process.platform === 'win32') {
        if (Config.notifications.flashWindow) {
            MainWindow.get()?.flashFrame(flash);
        }
    }
    if (process.platform === 'darwin' && Config.notifications.bounceIcon && Config.notifications.bounceIconType) {
        app.dock?.bounce(Config.notifications.bounceIconType);
    }
}

const notificationManager = new NotificationManager();
export default notificationManager;
