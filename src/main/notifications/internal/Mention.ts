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

export function showMention({options, channel, teamId, onClick}: ShowMentionArguments) {
    if (!channel) {
        const errMessage = 'Missing arguments';
        log.error('Notifications.showMentionError', errMessage);
        return;
    }
    const customOptions = {
        title: options.title,
        body: options.message,
    };
    const mention = new Mention(customOptions, channel, teamId);
    mention.on('show', () => {
        log.debug('Notifications.showMention.show');
    });
    mention.on('click', () => {
        log.debug('Notifications.showMention.click');
        onClick?.();
    });
    mention.show();
}
