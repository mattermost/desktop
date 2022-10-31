// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';
import cp from 'child_process';

import {Notification, shell} from 'electron';

import {getFocusAssist} from 'windows-focus-assist';
import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import {PLAY_SOUND} from 'common/communication';
import {TAB_MESSAGING} from 'common/tabs/TabView';

import {localizeMessage} from 'main/i18nManager';

import WindowManager from '../windows/windowManager';

import getLinuxDoNotDisturb from './internal/dndLinux';
import * as notificationsModule from './notification';

import {displayMention, displayDownloadCompleted} from './index';

const mentions = [];

jest.mock('child_process', () => ({
    execSync: jest.fn(),
}));

jest.mock('electron', () => {
    class NotificationMock {
        static isSupported = jest.fn();
        static didConstruct = jest.fn();

        constructor(options) {
            NotificationMock.didConstruct();
            this.callbackMap = new Map();
            mentions.push({body: options.body, value: this});
        }

        on = (event, callback) => {
            this.callbackMap.set(event, callback);
        }

        show = jest.fn().mockImplementation(() => {
            this.callbackMap.get('show')();
        });

        click = jest.fn().mockImplementation(() => {
            this.callbackMap.get('click')();
        });

        close = jest.fn();
    }

    return {
        app: {
            getAppPath: () => '/path/to/app',
        },
        Notification: NotificationMock,
        shell: {
            showItemInFolder: jest.fn(),
        },
    };
});

jest.mock('windows-focus-assist', () => ({
    getFocusAssist: jest.fn(),
}));

jest.mock('macos-notification-state', () => ({
    getDoNotDisturb: jest.fn(),
}));
jest.mock('node-notifier');
jest.mock('../windows/windowManager', () => ({
    getServerNameByWebContentsId: () => 'server_name',
    sendToRenderer: jest.fn(),
    flashFrame: jest.fn(),
    switchTab: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

describe('main/notifications', () => {
    describe('displayMention', () => {
        beforeEach(() => {
            Notification.isSupported.mockImplementation(() => true);
            getFocusAssist.mockReturnValue({value: false});
            getDarwinDoNotDisturb.mockReturnValue(false);
        });

        it('should do nothing when Notification is not supported', async () => {
            Notification.isSupported.mockImplementation(() => false);
            await displayMention({
                title: 'test',
                message: 'test body',
                channel: {id: 'channel_id'},
                teamId: 'team_id',
                url: 'http://server-1.com/team_id/channel_id',
                silent: false,
                webContents: {id: 1},
            });
            expect(Notification.didConstruct).not.toBeCalled();
        });

        it('should do nothing when alarms only is enabled on windows', async () => {
            const originalPlatform = process.platform;
            const sendNotificationWinLinuxInstance = jest.spyOn(notificationsModule, 'sendNotificationWinLinux');
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            getFocusAssist.mockReturnValue({value: 2});
            await displayMention({
                title: 'test',
                message: 'test body',
                channel: {id: 'channel_id'},
                teamId: 'team_id',
                url: 'http://server-1.com/team_id/channel_id',
                silent: false,
                webContents: {id: 1},
            });
            expect(notificationsModule.sendNotificationWinLinux).not.toBeCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            getFocusAssist.mockRestore();
            sendNotificationWinLinuxInstance.mockRestore();
        });

        it('should do nothing when dnd is enabled on mac', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            getDarwinDoNotDisturb.mockReturnValue(true);
            await displayMention({
                title: 'test',
                message: 'test body',
                channel: {id: 'channel_id'},
                teamId: 'team_id',
                url: 'http://server-1.com/team_id/channel_id',
                silent: false,
                webContents: {id: 1},
            });
            expect(Notification.didConstruct).not.toBeCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            getDarwinDoNotDisturb.mockRestore();
        });

        it('should do nothing when dnd is enabled on linux', async () => {
            const originalPlatform = process.platform;
            const sendNotificationWinLinuxInstance = jest.spyOn(notificationsModule, 'sendNotificationWinLinux');
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });

            cp.execSync.mockReturnValue('false');
            await displayMention({
                title: 'test',
                message: 'test body',
                channel: {id: 'channel_id'},
                teamId: 'team_id',
                url: 'http://server-1.com/team_id/channel_id',
                silent: false,
                webContents: {id: 1},
            });
            expect(notificationsModule.sendNotificationWinLinux).not.toBeCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            cp.execSync.mockRestore();
            sendNotificationWinLinuxInstance.mockRestore();
        });

        it('should play notification sound when custom sound is provided', async () => {
            await displayMention({
                title: 'test',
                message: 'test body',
                channel: {id: 'channel_id'},
                teamId: 'team_id',
                url: 'http://server-1.com/team_id/channel_id',
                silent: false,
                webContents: {id: 1},
                soundName: 'test_sound',
            });
            expect(WindowManager.sendToRenderer).toHaveBeenCalledWith(PLAY_SOUND, 'test_sound');
        });

        it('should switch tab when clicking on notification', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            await displayMention({
                title: 'click_test',
                message: 'mention_click_body',
                channel: {id: 'channel_id'},
                teamId: 'team_id',
                url: 'http://server-1.com/team_id/channel_id',
                silent: false,
                webContents: {id: 1, send: jest.fn()},
            });
            const mention = mentions.find((m) => m.body === 'mention_click_body');
            mention.value.click();
            expect(WindowManager.switchTab).toHaveBeenCalledWith('server_name', TAB_MESSAGING);
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('displayDownloadCompleted', () => {
        it('should open file when clicked', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            getDarwinDoNotDisturb.mockReturnValue(false);
            localizeMessage.mockReturnValue('test_filename');
            await displayDownloadCompleted(
                'test_filename',
                '/path/to/file',
                'server_name',
            );
            const mention = mentions.find((m) => m.body.includes('test_filename'));
            mention.value.click();
            expect(shell.showItemInFolder).toHaveBeenCalledWith('/path/to/file');
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('getLinuxDoNotDisturb', () => {
        let originalPlatform;
        beforeAll(() => {
            originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
        });

        afterAll(() => {
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should return false', () => {
            cp.execSync.mockReturnValue('true');
            expect(getLinuxDoNotDisturb()).toBe(false);
        });

        it('should return false if error is thrown', () => {
            cp.execSync.mockImplementation(() => {
                throw Error('error');
            });
            expect(getLinuxDoNotDisturb()).toBe(false);
        });

        it('should return true', () => {
            cp.execSync.mockReturnValue('false');
            expect(getLinuxDoNotDisturb()).toBe(true);
        });
    });
});
