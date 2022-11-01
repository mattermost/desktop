// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Notification} from 'electron';
import log from 'electron-log';

import {ShowElectronNotificationArguments} from 'types/notification';

const existingNotifications: Record<string, Notification | null> = {
    restartToUpgrade: null,
    upgrade: null,
};

export async function showElectronNotification({options, notificationType, onClick}: ShowElectronNotificationArguments) {
    const customOptions = {
        title: options.title,
        body: options.message,
    };

    const notification = new Notification(customOptions);

    // Hide previous identical notifications for Upgrades
    if (notificationType === 'restartToUpgrade' || notificationType === 'upgrade') {
        existingNotifications[notificationType]?.close?.();
        existingNotifications[notificationType] = notification;
    }

    notification.on('click', () => {
        log.debug('Notifications.showElectronNotification.click');
        onClick?.();
    });
    notification.on('show', () => {
        log.debug('Notifications.showElectronNotification.show');
    });
    notification.show();
}
