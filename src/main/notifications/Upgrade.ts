// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import {app, Notification} from 'electron';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_48.png');

const defaultOptions = {
    title: 'New desktop version available',
    silent: false,
    icon: appIconURL,
    urgency: 'normal' as Notification['urgency'],
    body: '',
};

export class UpgradeNotification extends Notification {
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
