// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, shell, Notification} from 'electron';

import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import Config from 'common/config';
import {PLAY_SOUND, NOTIFICATION_CLICKED} from 'common/communication';
import {Logger} from 'common/log';

import PermissionsManager from '../permissionsManager';
import ViewManager from '../views/viewManager';
import MainWindow from '../windows/mainWindow';

import {Mention} from './Mention';
import {DownloadNotification} from './Download';
import {NewVersionNotification, UpgradeNotification} from './Upgrade';
import getLinuxDoNotDisturb from './dnd-linux';
import getWindowsDoNotDisturb from './dnd-windows';

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
            return;
        }

        if (getDoNotDisturb()) {
            return;
        }

        const view = ViewManager.getViewByWebContentsId(webcontents.id);
        if (!view) {
            return;
        }
        if (!view.view.shouldNotify) {
            return;
        }
        const serverName = view.view.server.name;

        const options = {
            title: `${serverName}: ${title}`,
            body,
            silent,
            soundName,
        };

        if (!await PermissionsManager.doPermissionRequest(webcontents.id, 'notifications', view.view.server.url.toString())) {
            return;
        }

        const mention = new Mention(options, channelId, teamId);
        const mentionKey = `${mention.teamId}:${mention.channelId}`;
        this.allActiveNotifications.set(mention.uId, mention);

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
        });

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

        mention.on('failed', () => {
            this.allActiveNotifications.delete(mention.uId);
        });
        mention.show();
    }

    public displayDownloadCompleted(fileName: string, path: string, serverName: string) {
        log.debug('displayDownloadCompleted', {fileName, path, serverName});

        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return;
        }

        if (getDoNotDisturb()) {
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

    public displayUpgrade(version: string, handleUpgrade: () => void): void {
        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return;
        }
        if (getDoNotDisturb()) {
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

    public displayRestartToUpgrade(version: string, handleUpgrade: () => void): void {
        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return;
        }
        if (getDoNotDisturb()) {
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

function getDoNotDisturb() {
    if (process.platform === 'win32') {
        return getWindowsDoNotDisturb();
    }

    if (process.platform === 'darwin') {
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
