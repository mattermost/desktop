// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Notification} from 'electron';

import {MentionOptions} from 'types/notification';

import {localizeMessage} from 'main/i18nManager';

const defaultOptions = {
    title: localizeMessage('main.notifications.mention.title', 'Someone mentioned you'),
    silent: false,
};

export class Mention extends Notification {
    channel: {id: string}; // TODO: Channel from mattermost-redux
    teamId: string;

    constructor(customOptions: MentionOptions, channel: {id: string}, teamId = '') {
        const options = {...defaultOptions, ...customOptions};
        super(options);

        this.channel = channel;
        this.teamId = teamId;
    }
}
