// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';

import {app, Notification} from 'electron';
import log from 'electron-log';
import nodeNotifier from 'node-notifier';
import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';
import {NotificationOptions, SendNotificationArguments} from 'types/notification';

import WindowManager from '../windows/windowManager';

import {PLAY_SOUND} from 'common/communication';

import getWindowsDoNotDisturb from './internal/dnd-windows';
import getLinuxDoNotDisturb from './internal/dndLinux';
import {showMention} from './internal/Mention';
import {showElectronNotification} from './internal/Generic';

const logoPath = path.join(path.dirname(app.getAppPath()), 'src/assets/linux/app_icon.svg');
export const currentNotifications = new Map();

export function getDoNotDisturb() {
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

const defaultOptions: NotificationOptions = {
    icon: logoPath,
    sound: false,
    timeout: 10,
    appID: 'Mattermost.Desktop',
};

async function sendNotificationDarwin({options, channel, teamId, notificationType, onClick}: SendNotificationArguments): Promise<void> {
    if (!Notification.isSupported()) {
        log.error('notifications.sendNotificationDarwin', 'notification not supported');
        return;
    }

    switch (notificationType) {
    case 'mention':
        await showMention({options, channel, teamId, onClick});
        break;
    default:
        await showElectronNotification({options, onClick});
        break;
    }
}

export function sendNotificationWinLinux({options, tag, onClick, onTimeout}: Partial<SendNotificationArguments>): Promise<void> {
    return new Promise((resolve, reject) => {
        const notifyOptions: NotificationOptions = {
            ...defaultOptions,
            ...options,
        };

        if (tag) {
            const channelSpecificNumber = parseInt(tag, 10);
            notifyOptions.id = channelSpecificNumber;
            notifyOptions.remove = channelSpecificNumber;
        }
        nodeNotifier.notify(notifyOptions, (err, response, metadata) => {
            if (err) {
                reject(err);
            } else {
                log.debug('notifications.sendNotification.Callback', {response, metadata});
                switch (response) {
                case 'activate':
                    onClick?.(metadata);
                    WindowManager.restoreMain();
                    resolve();
                    break;
                case 'timeout':
                    onTimeout?.();
                    resolve();
                    break;
                default:
                    resolve();
                    break;
                }
            }
        });
    });
}

export const sendNotification = ({options, tag, silent, soundName, channel, teamId, notificationType, onClick, onTimeout}: SendNotificationArguments) => {
    if (getDoNotDisturb()) {
        return;
    }

    const isDarwin = process.platform === 'darwin';
    if (isDarwin) {
        sendNotificationDarwin({options, channel, notificationType, teamId, onClick});
    } else {
        sendNotificationWinLinux({options, tag, onClick, onTimeout});
    }

    // Play notification sound on the renderer process
    if (!silent && soundName) {
        WindowManager.sendToRenderer(PLAY_SOUND, soundName);
    }

    // Flash window
    WindowManager.flashFrame(true);
};
