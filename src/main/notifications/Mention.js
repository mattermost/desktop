// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, Notification, nativeImage} from 'electron';

import osVersion from 'common/osVersion';

const appIconURL = `file:///${app.getAppPath()}/assets/appicon_48.png`;

const defaultOptions = {
    title: 'Someone mentioned you',
    silent: false,
    icon: nativeImage.createFromDataURL(appIconURL),
    urgency: 'normal',
};
export const DEFAULT_WIN7 = 'Ding';

export class Mention extends Notification {
    constructor(customOptions, channel) {
        const options = {...defaultOptions, ...customOptions};
        if (process.platform === 'darwin') { // TODO: review
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
    }

    getNotificationSound = () => {
        return this.customSound;
    }
}
