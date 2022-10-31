// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Notification} from 'electron';
import log from 'electron-log';

import {MentionOptions, ShowMentionArguments} from 'types/notification';

import {localizeMessage} from 'main/i18nManager';

const defaultOptions = {
    title: localizeMessage('main.notifications.mention.title', 'Someone mentioned you'),
    silent: true,
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

export async function showMention({options, channel, teamId, onClick}: ShowMentionArguments) {
    return new Promise<void>((resolve, reject) => {
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
    });
}
