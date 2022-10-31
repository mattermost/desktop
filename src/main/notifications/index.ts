// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell} from 'electron';
import log from 'electron-log';
import {DisplayMentionArguments, NotificationOptions} from 'types/notification';

import {TAB_MESSAGING} from 'common/tabs/TabView';

import WindowManager from '../windows/windowManager';
import {localizeMessage} from 'main/i18nManager';

import {sendNotification} from './notification';

export const currentNotifications = new Map();

export function displayMention({title, message, channel, teamId, url, silent, webContents, soundName}: DisplayMentionArguments) {
    log.debug('Notifications.displayMention', {title, message, channel, teamId, url, silent, soundName});

    const serverName = WindowManager.getServerNameByWebContentsId(webContents.id);

    const options: NotificationOptions = {
        title: `${serverName}: ${title}`,
        message,
    };

    const tag = `${teamId}:${channel.id}`;
    const onClick = () => {
        log.debug('notification click', serverName);
        if (serverName) {
            WindowManager.switchTab(serverName, TAB_MESSAGING);
            webContents.send('notification-clicked', {channel, teamId, url});
        }
    };
    sendNotification({
        channel,
        notificationType: 'mention',
        options,
        silent,
        soundName,
        tag,
        teamId,
        onClick,
    });
}

export function displayDownloadCompleted(fileName: string, path: string, serverName: string) {
    log.debug('Notifications.displayDownloadCompleted', {fileName, path, serverName});

    const options = {
        title: process.platform === 'win32' ? serverName : localizeMessage('main.notifications.download.complete.title', 'Download Complete'),
        message: process.platform === 'win32' ? localizeMessage('main.notifications.download.complete.body', 'Download Complete \n {fileName}', {fileName}) : fileName,
        sound: true, // macos & windows only
    };

    const onClick = () => {
        shell.showItemInFolder(path.normalize());
    };

    sendNotification({
        options,
        onClick,
        notificationType: 'downloadCompleted',
    });
}

export function displayUpgrade(version: string, handleUpgrade: () => void): void {
    log.debug('Notifications.displayUpgrade', {version});

    const options: NotificationOptions = {
        title: localizeMessage('main.notifications.upgrade.newVersion.title', 'New desktop version available'),
        message: localizeMessage('main.notifications.upgrade.newVersion.body', 'A new version is available for you to download now.'),
        sound: true,
    };

    const onClick = () => {
        log.info(`User clicked to upgrade to ${version}`);
        handleUpgrade();
    };

    sendNotification({
        options,
        onClick,
        notificationType: 'upgrade',
    });
}

export function displayRestartToUpgrade(version: string, handleUpgrade: () => void): void {
    log.debug('Notifications.displayRestartToUpgrade', {version});

    const options: NotificationOptions = {
        title: localizeMessage('main.notifications.upgrade.newVersion.title', 'New desktop version available'),
        message: localizeMessage('main.notifications.upgrade.newVersion.body', 'A new version is available for you to download now.'),
        sound: true,
    };

    const onClick = () => {
        log.info(`User clicked to upgrade to ${version}`);
        handleUpgrade();
    };

    sendNotification({
        options,
        onClick,
        notificationType: 'upgrade',
    });
}

export function sendTestNotification() {
    log.debug('notifications.sendTestNotification');

    sendNotification({
        options: {
            title: 'Test notification',
            message: 'This is a test notification',
            sound: true,
        },
        notificationType: 'test',
    });
}

