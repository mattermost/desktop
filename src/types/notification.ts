// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Notification, NotificationMetadata} from 'node-notifier';
import WindowsBalloon from 'node-notifier/notifiers/balloon';
import Growl from 'node-notifier/notifiers/growl';
import NotifySend from 'node-notifier/notifiers/notifysend';
import WindowsToaster from 'node-notifier/notifiers/toaster';

export type NotificationOptions = WindowsToaster.Notification & WindowsBalloon.Notification & NotifySend.Notification & Growl.Notification & Notification;

type MentionPayload = {
    channel: {
        id: string;
    };
    teamId: string;
    url: string;
    silent: boolean;
    webContents: Electron.WebContents;
    soundName: string;
}

type DownloadPayload = {
    fileName: string;
    path: string;
    serverName: string;
}

type UpgradePayload = {
    version: string;
    handleUpgrade: () => void;
}

type PromiseResolve = (value: void | PromiseLike<void>) => void;
type PromiseReject = (reason?: unknown) => void;

export type MentionOptions = {
    title?: string;
    body?: string;
}

export type NotificationPayload = MentionPayload | DownloadPayload | UpgradePayload;

export type SendNotificationArguments = {
    options: NotificationOptions;
    silent?: boolean;
    tag?: string;
    soundName?: string;
    channel?: MentionPayload['channel'];
    teamId?: MentionPayload['teamId'];
    onClick?: (data?: NotificationMetadata) => void;
    onTimeout?: () => void;
    notificationType: 'mention' | 'downloadCompleted' | 'upgrade' | 'restartToUpgrade' | 'test';
};

export type SendNotificationArgumentsWinLinux = Omit<SendNotificationArguments, 'webContents' | 'serverName'>

export type DisplayMentionArguments = {
    title: string;
    message: string;
    channel: {id: string};
    teamId: string;
    url: string;
    silent: boolean;
    webContents: Electron.WebContents;
    soundName: string;
}

export type ShowElectronNotificationArguments = {
    options: SendNotificationArguments['options'];
    notificationType?: SendNotificationArguments['notificationType'];
    onClick: SendNotificationArguments['onClick'];
    resolve: PromiseResolve;
}

export type ShowMentionArguments = ShowElectronNotificationArguments & {
    channel: SendNotificationArguments['channel'];
    teamId: SendNotificationArguments['teamId'];
    reject: PromiseReject;
}
