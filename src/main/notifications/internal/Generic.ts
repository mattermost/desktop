// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Notification} from 'electron';

import {ShowElectronNotificationArguments} from 'types/notification';

const existingNotifications: Record<string, Notification | null> = {
    restartToUpgrade: null,
    upgrade: null,
};

export function showElectronNotification({options, notificationType, onClick, resolve}: ShowElectronNotificationArguments) {
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
        onClick?.();
    });
    notification.on('show', () => {
        resolve?.();
    });
    notification.show();
}
