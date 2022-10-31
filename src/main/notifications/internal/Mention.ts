// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';

import {app, Notification} from 'electron';
import log from 'electron-log';

import {MentionOptions, ShowMentionArguments} from 'types/notification';

import {localizeMessage} from 'main/i18nManager';

const assetsDir = path.resolve(app.getAppPath(), 'assets');
const appIconURL = path.resolve(assetsDir, 'appicon_48.png');

const defaultOptions = {
    title: localizeMessage('main.notifications.mention.title', 'Someone mentioned you'),
    silent: false,
    icon: appIconURL,
};

class Mention extends Notification {
    channel: {id: string}; // TODO: Channel from mattermost-redux
    teamId: string;

    constructor(customOptions: MentionOptions, channel: {id: string}, teamId = '') {
        const options = {...defaultOptions, ...customOptions};
        super(options);

        this.channel = channel;
        this.teamId = teamId;
    }
}

export function showMention({options, channel, teamId, onClick, reject, resolve}: ShowMentionArguments) {
    if (!channel) {
        const errMessage = 'Missing arguments';
        reject(errMessage);
        return;
    }

    const customOptions = {
        title: options.title,
        body: options.message,
    };

    const mention = new Mention(customOptions, channel, teamId);

    mention.on('show', () => {
        log.debug('Notifications.displayMention.show');
        resolve();
    });

    mention.on('click', () => {
        onClick?.();
    });
    mention.show();
}
