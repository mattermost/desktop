// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell, Notification} from 'electron';
import log from 'electron-log';

import {PLAY_SOUND} from 'common/communication';

import * as windowManager from '../windows/windowManager';

import {Mention} from './Mention';
import {DownloadNotification} from './Download';

const currentNotifications = new Map();

export function displayMention(title, body, channel, teamId, silent, webcontents, data) {
    if (!Notification.isSupported()) {
        log.error('notification not supported');
        return;
    }
    const serverName = windowManager.getServerNameByWebContentsId(webcontents.id);

    const options = {
        title: `${serverName}: ${title}`,
        body,
        silent,
        data,
    };

    const mention = new Mention(options, channel, teamId);
    const mentionKey = `${mention.teamId}:${mention.channel.id}`;

    mention.on('show', () => {
        // On Windows, manually dismiss notifications from the same channel and only show the latest one
        if (process.platform === 'win32') {
            if (currentNotifications.has(mentionKey)) {
                log.info(`close ${mentionKey}`);
                currentNotifications.get(mentionKey).close();
                currentNotifications.delete(mentionKey);
            }
            currentNotifications.set(mentionKey, mention);
        }
        const notificationSound = mention.getNotificationSound();
        if (notificationSound) {
            windowManager.sendToRenderer(PLAY_SOUND, notificationSound);
        }
        windowManager.flashFrame(true);
    });

    mention.on('click', () => {
        if (serverName) {
            windowManager.switchServer(serverName, true);
            webcontents.send('notification-clicked', {channel, teamId});
        }
    });
    mention.show();
}

export function displayDownloadCompleted(fileName, path, serverInfo) {
    if (!Notification.isSupported()) {
        log.error('notification not supported');
        return;
    }
    const download = new DownloadNotification(fileName, serverInfo);

    download.on('show', () => {
        windowManager.flashFrame(true);
    });

    download.on('click', () => {
        shell.showItemInFolder(path.normalize());
    });
    download.show();
}
