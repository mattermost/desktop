// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {Notification, shell} from 'electron';

import {PLAY_SOUND} from 'common/communication';
import {TAB_MESSAGING} from 'common/tabs/TabView';

import {t} from 'main/i18nManager';

import WindowManager from '../windows/windowManager';

import {displayMention, displayDownloadCompleted, currentNotifications} from './index';

const mentions = [];

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

jest.mock('../windows/windowManager', () => ({
    getServerNameByWebContentsId: () => 'server_name',
    sendToRenderer: jest.fn(),
    flashFrame: jest.fn(),
    switchTab: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    t: jest.fn(),
}));

describe('main/notifications', () => {
    describe('displayMention', () => {
        beforeEach(() => {
            Notification.isSupported.mockImplementation(() => true);
        });

        it('should do nothing when Notification is not supported', () => {
            Notification.isSupported.mockImplementation(() => false);
            displayMention(
                'test',
                'test body',
                {id: 'channel_id'},
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1},
                {},
            );
            expect(Notification.didConstruct).not.toBeCalled();
        });

        it('should play notification sound when custom sound is provided', () => {
            displayMention(
                'test',
                'test body',
                {id: 'channel_id'},
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1},
                {soundName: 'test_sound'},
            );
            expect(WindowManager.sendToRenderer).toHaveBeenCalledWith(PLAY_SOUND, 'test_sound');
        });

        it('should remove existing notification from the same channel/team on windows', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            displayMention(
                'test',
                'test body',
                {id: 'channel_id'},
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1},
                {},
            );

            expect(currentNotifications.has('team_id:channel_id')).toBe(true);

            const existingMention = currentNotifications.get('team_id:channel_id');
            currentNotifications.delete = jest.fn();
            displayMention(
                'test',
                'test body 2',
                {id: 'channel_id'},
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1},
                {},
            );

            expect(currentNotifications.delete).toHaveBeenCalled();
            expect(existingMention.close).toHaveBeenCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should switch tab when clicking on notification', () => {
            displayMention(
                'click_test',
                'mention_click_body',
                {id: 'channel_id'},
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1, send: jest.fn()},
                {},
            );
            const mention = mentions.find((m) => m.body === 'mention_click_body');
            mention.value.click();
            expect(WindowManager.switchTab).toHaveBeenCalledWith('server_name', TAB_MESSAGING);
        });
    });

    describe('displayDownloadCompleted', () => {
        it('should open file when clicked', () => {
            t.mockReturnValue('test_filename');
            displayDownloadCompleted(
                'test_filename',
                '/path/to/file',
                'server_name',
            );
            const mention = mentions.find((m) => m.body.includes('test_filename'));
            mention.value.click();
            expect(shell.showItemInFolder).toHaveBeenCalledWith('/path/to/file');
        });
    });
});
