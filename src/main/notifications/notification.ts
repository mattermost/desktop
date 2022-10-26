// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';

import {app} from 'electron';
import log from 'electron-log';
import nodeNotifier from 'node-notifier';
import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';
import {NotificationOptions, SendNotificationArguments} from 'types/notification';

import WindowManager from '../windows/windowManager';

import {PLAY_SOUND} from 'common/communication';

import getLinuxDoNotDisturb from './dndLinux';
import getWindowsDoNotDisturb from './dnd-windows';

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
};

export const sendNotification = ({options, tag, silent = false, soundName, onClick, onTimeout}: SendNotificationArguments): void => {
    if (getDoNotDisturb()) {
        return;
    }

    const notifyOptions = {
        ...defaultOptions,
        ...options,
        remove: tag, // remove previous notifications for the same server/channel
    };

    // Play notification sound on the renderer process
    if (!silent && soundName) {
        WindowManager.sendToRenderer(PLAY_SOUND, soundName);
    }

    // Flash window
    WindowManager.flashFrame(true);

    nodeNotifier.notify(notifyOptions, (err, response, metadata) => {
        if (err) {
            log.error('notifications.sendNotification.Error', {err});
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
        }
    });
    nodeNotifier.on('timeout', () => {
        nodeNotifier.notify(notifyOptions);
    });
};
