// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell} from 'electron';
import log from 'electron-log';
import {DisplayMentionArguments, NotificationOptions} from 'types/notification';

import {TAB_MESSAGING} from 'common/tabs/TabView';

import WindowManager from '../windows/windowManager';
import {localizeMessage} from 'main/i18nManager';

import {NewVersionNotification, UpgradeNotification} from './Upgrade';

import {sendNotification} from './notification';

export const currentNotifications = new Map();

export function displayMention({title, message, channel, teamId, url, silent, webcontents, soundName}: DisplayMentionArguments) {
    log.debug('Notifications.displayMention', {title, message, channel, teamId, url, silent, soundName});

    const serverName = WindowManager.getServerNameByWebContentsId(webcontents.id);

    const options: NotificationOptions = {
        title: `${serverName}: ${title}`,
        message,
    };

    const tag = `${teamId}:${channel.id}`;
    const onClick = () => {
        log.debug('notification click', serverName);
        if (serverName) {
            WindowManager.switchTab(serverName, TAB_MESSAGING);
            webcontents.send('notification-clicked', {channel, teamId, url});
        }
    };
    sendNotification({
        options,
        tag,
        soundName,
        silent,
        onClick,
    });
}

export function displayDownloadCompleted(fileName: string, path: string, serverName: string) {
    log.debug('Notifications.displayDownloadCompleted', {fileName, path, serverName});

    const options = {
        title: process.platform === 'win32' ? serverName : localizeMessage('main.notifications.download.complete.title', 'Download Complete'),
        message: process.platform === 'win32' ? localizeMessage('main.notifications.download.complete.body', 'Download Complete \n {fileName}', {fileName}) : fileName,
    };

    const onClick = () => {
        shell.showItemInFolder(path.normalize());
    };

    WindowManager.flashFrame(true);

    sendNotification({
        options,
        onClick,
    });
}

let upgrade: NewVersionNotification;

export function displayUpgrade(version: string, handleUpgrade: () => void): void {
    if (upgrade) {
        upgrade.close();
    }
    upgrade = new NewVersionNotification();
    upgrade.on('click', () => {
        log.info(`User clicked to upgrade to ${version}`);
        handleUpgrade();
    });
    upgrade.show();
}

let restartToUpgrade;
export function displayRestartToUpgrade(version: string, handleUpgrade: () => void): void {
    restartToUpgrade = new UpgradeNotification();
    restartToUpgrade.on('click', () => {
        log.info(`User requested perform the upgrade now to ${version}`);
        handleUpgrade();
    });
    restartToUpgrade.show();
}

export function sendTestNotification() {
    log.debug('notifications.sendTestNotification');

    sendNotification({
        options: {
            title: 'Test notification',
            message: 'This is a test notification',
            sound: true,
        },
    });
}

