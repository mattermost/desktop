// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell, Notification} from 'electron';
import log from 'electron-log';

import {MentionData} from 'types/notification';

import {PLAY_SOUND} from 'common/communication';
import {TAB_MESSAGING} from 'common/tabs/TabView';

import * as windowManager from '../windows/windowManager';

import {Mention} from './Mention';
import {DownloadNotification} from './Download';

const currentNotifications = new Map();

export function displayMention(title: string, body: string, channel: {id: string}, teamId: string, url: string, silent: boolean, webcontents: Electron.WebContents, data: MentionData) {
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
            windowManager.switchTab(serverName, TAB_MESSAGING);
            webcontents.send('notification-clicked', {channel, teamId, url});
        }
    });
    mention.show();
}

export function displayDownloadCompleted(fileName: string, path: string, serverName: string) {
    if (!Notification.isSupported()) {
        log.error('notification not supported');
        return;
    }
    const download = new DownloadNotification(fileName, serverName);

    download.on('show', () => {
        windowManager.flashFrame(true);
    });

    download.on('click', () => {
        shell.showItemInFolder(path.normalize());
    });
    download.show();
}
