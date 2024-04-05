// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, shell, Notification} from 'electron';
import isDev from 'electron-is-dev';
import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import {PLAY_SOUND, NOTIFICATION_CLICKED} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';

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
    private mentionsPerChannel: Map<string, Mention> = new Map();
    private allActiveNotifications: Map<string, Notification> = new Map();
    private upgradeNotification?: NewVersionNotification;
    private restartToUpgradeNotification?: UpgradeNotification;

    public async displayMention(title: string, body: string, channelId: string, teamId: string, url: string, silent: boolean, webcontents: Electron.WebContents, soundName: string) {
        log.debug('displayMention', {title, body, channelId, teamId, url, silent, soundName});

        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return {result: 'error', reason: 'notification_api', data: 'notification not supported'};
        }

        if (await getDoNotDisturb()) {
            return {result: 'not_sent', reason: 'os_dnd'};
        }

        const view = ViewManager.getViewByWebContentsId(webcontents.id);
        if (!view) {
            return {result: 'error', reason: 'missing_view'};
        }
        if (!view.view.shouldNotify) {
            return {result: 'error', reason: 'view_should_not_notify'};
        }
        const serverName = view.view.server.name;

        const options = {
            title: `${serverName}: ${title}`,
            body,
            silent,
            soundName,
        };

        if (!await PermissionsManager.doPermissionRequest(webcontents.id, 'notifications', view.view.server.url.toString())) {
            return {result: 'not_sent', reason: 'notifications_permission_disallowed'};
        }

        const mention = new Mention(options, channelId, teamId);
        const mentionKey = `${mention.teamId}:${mention.channelId}`;
        this.allActiveNotifications.set(mention.uId, mention);

        mention.on('click', () => {
            log.debug('notification click', serverName, mention);

            this.allActiveNotifications.delete(mention.uId);
            MainWindow.show();
            if (serverName) {
                ViewManager.showById(view.id);
                webcontents.send(NOTIFICATION_CLICKED, channelId, teamId, url);
            }
        });

        mention.on('close', () => {
            this.allActiveNotifications.delete(mention.uId);
        });

        return new Promise((resolve) => {
            // If mention never shows somehow, resolve the promise after 10s
            const timeout = setTimeout(() => {
                resolve({result: 'error', reason: 'notification_timeout'});
            }, 10000);

            mention.on('show', () => {
                log.debug('displayMention.show');

                // On Windows, manually dismiss notifications from the same channel and only show the latest one
                if (process.platform === 'win32') {
                    if (this.mentionsPerChannel.has(mentionKey)) {
                        log.debug(`close ${mentionKey}`);
                        this.mentionsPerChannel.get(mentionKey)?.close();
                        this.mentionsPerChannel.delete(mentionKey);
                    }
                    this.mentionsPerChannel.set(mentionKey, mention);
                }
                const notificationSound = mention.getNotificationSound();
                if (notificationSound) {
                    MainWindow.sendToRenderer(PLAY_SOUND, notificationSound);
                }
                flashFrame(true);
                clearTimeout(timeout);
                resolve({result: 'success'});
            });

            mention.on('failed', (_, error) => {
                this.allActiveNotifications.delete(mention.uId);
                clearTimeout(timeout);
                resolve({result: 'error', reason: 'electron_notification_failed', data: error});
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
        this.allActiveNotifications.set(download.uId, download);

        download.on('show', () => {
            flashFrame(true);
        });

        download.on('click', () => {
            shell.showItemInFolder(path.normalize());
            this.allActiveNotifications.delete(download.uId);
        });

        download.on('close', () => {
            this.allActiveNotifications.delete(download.uId);
        });

        download.on('failed', () => {
            this.allActiveNotifications.delete(download.uId);
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
}

async function getDoNotDisturb() {
    if (process.platform === 'win32') {
        return getWindowsDoNotDisturb();
    }

    // We have to turn this off for dev mode because the Electron binary doesn't have the focus center API entitlement
    if (process.platform === 'darwin' && !isDev) {
        return getDarwinDoNotDisturb();
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
    if (process.platform === 'darwin' && Config.notifications.bounceIcon) {
        app.dock.bounce(Config.notifications.bounceIconType);
    }
}

const notificationManager = new NotificationManager();
export default notificationManager;
