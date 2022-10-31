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

const defaultOptions: NotificationOptions = {
    icon: logoPath,
    sound: false,
    timeout: 10,
    appID: 'Mattermost.Desktop',
};

const isDarwin = process.platform === 'darwin';

function sendNotificationDarwin({options, channel, teamId, notificationType, onClick}: SendNotificationArguments): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!Notification.isSupported()) {
            const errMessage = 'notification not supported';
            reject(errMessage);
            return;
        }

        switch (notificationType) {
        case 'mention':
            showMention({options, channel, teamId, onClick, reject, resolve});
            break;
        default:
            showElectronNotification({options, onClick, resolve});
            break;
        }
    });
}

function sendNotificationWinLinux({options, tag, onClick, onTimeout}: Partial<SendNotificationArguments>): Promise<void> {
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
                    break;
                case 'timeout':
                    onTimeout?.();
                    break;
                default:
                    break;
                }
                resolve();
            }
        });
    });
}

export const sendNotification = async ({options, tag, silent, soundName, channel, teamId, notificationType, onClick, onTimeout}: SendNotificationArguments): Promise<void> => {
    try {
        if (getDoNotDisturb()) {
            return;
        }

        if (isDarwin) {
            await sendNotificationDarwin({options, channel, notificationType, teamId, onClick});
        } else {
            await sendNotificationWinLinux({options, tag, onClick, onTimeout});
        }

        // Play notification sound on the renderer process
        if (!silent && soundName) {
            WindowManager.sendToRenderer(PLAY_SOUND, soundName);
        }

        // Flash window
        WindowManager.flashFrame(true);
    } catch (err) {
        log.error('notifications.sendNotification.error', {err});
    }
};
