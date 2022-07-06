// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';
import path from 'path';

import {app, Notification} from 'electron';

import Utils from 'common/utils/util';

import {t} from 'main/i18nManager';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_48.png');

const defaultOptions = {
    title: t('main.notifications.download.complete.title', 'Download Complete'),
    silent: false,
    icon: appIconURL,
    urgency: 'normal' as Notification['urgency'],
    body: '',
};

export class DownloadNotification extends Notification {
    constructor(fileName: string, serverName: string) {
        const options = {...defaultOptions};
        if (process.platform === 'darwin' || (process.platform === 'win32' && Utils.isVersionGreaterThanOrEqualTo(os.release(), '10.0'))) {
            // Notification Center shows app's icon, so there were two icons on the notification.
            Reflect.deleteProperty(options, 'icon');
        }

        options.title = process.platform === 'win32' ? serverName : t('main.notifications.download.complete.title', 'Download Complete');
        options.body = process.platform === 'win32' ? t('main.notifications.download.complete.body', 'Download Complete \n {fileName}', {fileName}) : fileName;

        super(options);
    }
}
