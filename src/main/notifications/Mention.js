// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import {app, Notification} from 'electron';

import osVersion from 'common/osVersion';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_48.png');

const defaultOptions = {
    title: 'Someone mentioned you',
    silent: false,
    icon: appIconURL,
    urgency: 'normal',
};
export const DEFAULT_WIN7 = 'Ding';

export class Mention extends Notification {
    constructor(customOptions, channel, teamId) {
        const options = {...defaultOptions, ...customOptions};
        if (process.platform === 'darwin') {
            // Notification Center shows app's icon, so there were two icons on the notification.
            Reflect.deleteProperty(options, 'icon');
        }
        const isWin7 = (process.platform === 'win32' && osVersion.isLowerThanOrEqualWindows8_1() && DEFAULT_WIN7);
        const customSound = !options.silent && ((options.data && options.data.soundName !== 'None' && options.data.soundName) || isWin7);
        if (customSound) {
            options.silent = true;
        }
        super(options);
        this.customSound = customSound;
        this.channel = channel;
        this.teamId = teamId;
    }

    getNotificationSound = () => {
        return this.customSound;
    }
}
