// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';
import path from 'path';

import {app, Notification} from 'electron';
import {v4 as uuid} from 'uuid';

import Utils from 'common/utils/util';
import {localizeMessage} from 'main/i18nManager';

import type {MentionOptions} from 'types/notification';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_48.png');

const defaultOptions = {
    title: localizeMessage('main.notifications.mention.title', 'Someone mentioned you'),
    silent: false,
    icon: appIconURL,
    urgency: 'normal' as Notification['urgency'],
};
const DEFAULT_WIN7 = 'Ding';

export class Mention extends Notification {
    customSound: string;
    channelId: string;
    teamId: string;
    uId: string;

    constructor(customOptions: MentionOptions, channelId: string, teamId: string) {
        const options = {...defaultOptions, ...customOptions};
        if (process.platform === 'darwin' || (process.platform === 'win32' && Utils.isVersionGreaterThanOrEqualTo(os.release(), '10.0'))) {
            // Notification Center shows app's icon, so there were two icons on the notification.
            Reflect.deleteProperty(options, 'icon');
        }
        const isWin7 = (process.platform === 'win32' && !Utils.isVersionGreaterThanOrEqualTo(os.release(), '6.3') && DEFAULT_WIN7);
        const customSound = String(!options.silent && ((options.soundName !== 'None' && options.soundName) || isWin7));
        if (customSound) {
            options.silent = true;
        }
        super(options);

        this.customSound = customSound;
        this.channelId = channelId;
        this.teamId = teamId;
        this.uId = uuid();
    }

    getNotificationSound = () => {
        return this.customSound;
    };
}
