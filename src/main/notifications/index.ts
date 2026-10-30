// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, shell, Notification, ipcMain} from 'electron';
import isDev from 'electron-is-dev';
import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import MainWindow from 'app/mainWindow/mainWindow';
import TabManager from 'app/tabs/tabManager';
import WebContentsManager from 'app/views/webContentsManager';
import {PLAY_SOUND, NOTIFICATION_CLICKED, BROWSER_HISTORY_PUSH, OPEN_NOTIFICATION_PREFERENCES} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import viewManager from 'common/views/viewManager';
import DeveloperMode from 'main/developerMode';
import {localizeMessage} from 'main/i18nManager';
import PermissionsManager from 'main/security/permissionsManager';
import {openExternalSafely} from 'main/utils';

import getLinuxDoNotDisturb from './dnd-linux';
import getWindowsDoNotDisturb from './dnd-windows';
import {DownloadNotification} from './Download';
import {Mention} from './Mention';
import {NewVersionNotification, UpgradeNotification} from './Upgrade';

const log = new Logger('Notifications');

const MACOS_DND_TIMEOUT = 1000;

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
        log.debug('displayMention', {silent, soundName});

        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return {status: 'error', reason: 'notification_api', data: 'notification not supported'};
        }

        const doNotDisturb = await getDoNotDisturb();
        if (shouldSuppressForDoNotDisturb(doNotDisturb)) {
            log.debug('do not disturb is on, will not send');
            return {status: 'not_sent', reason: 'os_dnd'};
        }

        const view = WebContentsManager.getViewByWebContentsId(webcontents.id);
        if (!view) {
            log.error('missing view', {webcontentsId: webcontents.id});
            return {status: 'error', reason: 'missing_view'};
        }
        const server = ServerManager.getServer(view.serverId);
        if (!server) {
            log.error('missing server', {serverId: view.serverId});
            return {status: 'error', reason: 'missing_server'};
        }
        const serverName = server.name;
        if (!viewManager.isPrimaryView(view.id)) {
            log.debug('should not notify for this view', {webcontentsId: webcontents.id});
            return {status: 'not_sent', reason: 'view_should_not_notify'};
        }

        const options = {
            title: `${serverName}: ${title}`,
            body,
            silent,
            soundName,
        };

        if (!await PermissionsManager.doPermissionRequest(webcontents.id, 'notifications', {requestingUrl: server.url.toString(), isMainFrame: false})) {
            log.verbose('permissions disallowed', {webcontentsId: webcontents.id, serverId: server.id});
            return {status: 'not_sent', reason: 'notifications_permission_disallowed'};
        }

        const mention = new Mention(options, channelId, teamId);
        this.allActiveNotifications?.set(mention.uId, mention);

        mention.on('click', () => {
            log.debug('notification click', server.id, mention.uId);

            this.allActiveNotifications?.delete(mention.uId);

            // Show the window after navigation has finished to avoid the focus handler
            // being called before the current channel has updated
            const focus = () => {
                MainWindow.show();
                TabManager.switchToTab(view.id);
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
                log.debug('notification timeout', server.id, mention.uId);
                resolve({status: 'error', reason: 'notification_timeout'});
            }, 10000);
            let failed = false;

            mention.on('show', () => {
                // Ensure the failed event isn't also called, if it is we should resolve using its method
                setTimeout(() => {
                    if (!failed) {
                        log.debug('displayMention.show', server.id, mention.uId);

                        // On Windows, manually dismiss notifications from the same channel and only show the latest one
                        if (process.platform === 'win32') {
                            const mentionKey = `${mention.teamId}:${mention.channelId}`;
                            if (this.mentionsPerChannel?.has(mentionKey)) {
                                log.debug('close');
                                this.mentionsPerChannel?.get(mentionKey)?.close();
                                this.mentionsPerChannel?.delete(mentionKey);
                            }
                            this.mentionsPerChannel?.set(mentionKey, mention);
                        }

                        // The OS can't silence our own sound or the dock bounce, so skip them under DND
                        if (!doNotDisturb) {
                            const notificationSound = mention.getNotificationSound();
                            if (notificationSound) {
                                MainWindow.sendToRenderer(PLAY_SOUND, notificationSound);
                            }
                            flashFrame(true);
                        }
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
                    log.error('notification failed to show', server.id, mention.uId, error);
                    resolve({status: 'error', reason: 'electron_notification_failed', data: error});
                }
            });
            mention.show();
        });
    }

    public async displayDownloadCompleted(fileName: string, path: string, serverName: string) {
        log.debug('displayDownloadCompleted');

        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return;
        }

        const doNotDisturb = await getDoNotDisturb();
        if (shouldSuppressForDoNotDisturb(doNotDisturb)) {
            return;
        }

        const download = new DownloadNotification(fileName, serverName);
        this.allActiveNotifications?.set(download.uId, download);

        download.on('show', () => {
            if (!doNotDisturb) {
                flashFrame(true);
            }
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

    public async displayServerModal(serverId: string) {
        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return;
        }
        if (await getDoNotDisturb()) {
            return;
        }

        const server = ServerManager.getServer(serverId);
        if (!server) {
            return;
        }

        const notificationKey = `serverModal-${serverId}`;
        const notification = new Notification({
            title: localizeMessage('main.notifications.serverModal.title', '{serverName} needs your attention', {serverName: server.name}),
            body: localizeMessage('main.notifications.serverModal.body', 'Switch to this server to respond.'),
            silent: false,
        });
        this.allActiveNotifications?.set(notificationKey, notification);

        notification.on('show', () => {
            flashFrame(true);
        });

        notification.on('click', () => {
            MainWindow.show();
            if (ServerManager.getServer(serverId)) {
                ServerManager.updateCurrentServer(serverId);
            }
            this.allActiveNotifications?.delete(notificationKey);
        });

        notification.on('close', () => {
            this.allActiveNotifications?.delete(notificationKey);
        });

        notification.on('failed', () => {
            this.allActiveNotifications?.delete(notificationKey);
        });
        notification.show();
    }

    public async displayUpgrade(version: string, handleUpgrade: () => void) {
        if (!Notification.isSupported()) {
            log.error('notification not supported');
            return;
        }
        if (shouldSuppressForDoNotDisturb(await getDoNotDisturb())) {
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
        if (shouldSuppressForDoNotDisturb(await getDoNotDisturb())) {
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
            openExternalSafely('x-apple.systempreferences:com.apple.preference.notifications?Notifications');
            break;
        case 'win32':
            openExternalSafely('ms-settings:notifications');
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
        // The Focus status check doesn't resolve until the user answers the Focus status permission prompt,
        // so don't let it hold up notifications indefinitely
        let timeout: NodeJS.Timeout | undefined;
        try {
            return await Promise.race([
                getDarwinDoNotDisturb(),
                new Promise<boolean>((resolve) => {
                    timeout = setTimeout(() => {
                        log.warn('macOS DND check timed out');
                        resolve(false);
                    }, MACOS_DND_TIMEOUT);
                }),
            ]);
        } catch (e) {
            log.warn('macOS DND check threw an error', {e});
            return false;
        } finally {
            clearTimeout(timeout);
        }
    }

    if (process.platform === 'linux') {
        return getLinuxDoNotDisturb();
    }

    return false;
}

// macOS applies Focus itself, including any apps the user allowed through it,
// so the notification is always handed to the OS there. Focus status only tells us
// whether a Focus is on, not whether it allows this app.
function shouldSuppressForDoNotDisturb(doNotDisturb: boolean) {
    return doNotDisturb && process.platform !== 'darwin';
}

export function flashFrame(flash: boolean) {
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
