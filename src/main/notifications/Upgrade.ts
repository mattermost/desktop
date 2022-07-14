// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, Notification} from 'electron';

import {localizeMessage} from 'main/i18nManager';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_48.png');

const defaultOptions = {
    title: localizeMessage('main.notifications.upgrade.newVersion.title', 'New desktop version available'),
    body: localizeMessage('main.notifications.upgrade.newVersion.body', 'A new version is available for you to download now.'),
    silent: false,
    icon: appIconURL,
    urgency: 'normal' as Notification['urgency'],
};

export class NewVersionNotification extends Notification {
    constructor() {
        const options = {...defaultOptions};
        if (process.platform === 'win32') {
            options.icon = appIconURL;
        } else if (process.platform === 'darwin') {
            // Notification Center shows app's icon, so there were two icons on the notification.
            Reflect.deleteProperty(options, 'icon');
        }

        super(options);
    }
}

export class UpgradeNotification extends Notification {
    constructor() {
        const options = {...defaultOptions};
        options.title = localizeMessage('main.notifications.upgrade.readyToInstall.title', 'Click to restart and install update');
        options.body = localizeMessage('main.notifications.upgrade.readyToInstall.body', 'A new desktop version is ready to install now.');
        if (process.platform === 'win32') {
            options.icon = appIconURL;
        } else if (process.platform === 'darwin') {
            // Notification Center shows app's icon, so there were two icons on the notification.
            Reflect.deleteProperty(options, 'icon');
        }

        super(options);
    }
}
