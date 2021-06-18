// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import {app, Notification} from 'electron';
import {ServerFromURL} from 'types/utils';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_48.png');

const defaultOptions = {
    title: 'Download Complete',
    silent: false,
    icon: appIconURL,
    urgency: 'normal' as Notification['urgency'],
    body: '',
};

export class DownloadNotification extends Notification {
    constructor(fileName: string, serverInfo: ServerFromURL) {
        const options = {...defaultOptions};
        if (process.platform === 'win32') {
            options.icon = appIconURL;
        } else if (process.platform === 'darwin') {
            // Notification Center shows app's icon, so there were two icons on the notification.
            Reflect.deleteProperty(options, 'icon');
        }

        options.title = process.platform === 'win32' ? serverInfo.name : 'Download Complete';
        options.body = process.platform === 'win32' ? `Download Complete \n ${fileName}` : fileName;

        super(options);
    }
}
