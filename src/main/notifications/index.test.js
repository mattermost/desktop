// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';
import cp from 'child_process';

import {Notification, shell, app} from 'electron';

import {getFocusAssist} from 'windows-focus-assist';
import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import {PLAY_SOUND} from 'common/communication';
import Config from 'common/config';

import {localizeMessage} from 'main/i18nManager';
import MainWindow from 'main/windows/mainWindow';
import ViewManager from 'main/views/viewManager';

import getLinuxDoNotDisturb from './dnd-linux';

import {displayMention, displayDownloadCompleted, currentNotifications} from './index';

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
            dock: {
                bounce: jest.fn(),
            },
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
jest.mock('../views/viewManager', () => ({
    getViewByWebContentsId: () => ({
        id: 'server_id',
        view: {
            server: {
                name: 'server_name',
            },
        },
    }),
    showById: jest.fn(),
}));
jest.mock('../windows/mainWindow', () => ({
    get: jest.fn(),
    show: jest.fn(),
    sendToRenderer: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('common/config', () => ({}));

describe('main/notifications', () => {
    describe('displayMention', () => {
        const mainWindow = {
            flashFrame: jest.fn(),
        };

        beforeEach(() => {
            Notification.isSupported.mockImplementation(() => true);
            getFocusAssist.mockReturnValue({value: false});
            getDarwinDoNotDisturb.mockReturnValue(false);
            Config.notifications = {};
            MainWindow.get.mockReturnValue(mainWindow);
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.notifications = {};
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

        it('should do nothing when alarms only is enabled on windows', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            getFocusAssist.mockReturnValue({value: 2});
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

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should do nothing when dnd is enabled on mac', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            getDarwinDoNotDisturb.mockReturnValue(true);
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

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
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
            expect(MainWindow.sendToRenderer).toHaveBeenCalledWith(PLAY_SOUND, 'test_sound');
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

        it('should switch view when clicking on notification', () => {
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
            expect(MainWindow.show).toHaveBeenCalled();
            expect(ViewManager.showById).toHaveBeenCalledWith('server_id');
        });

        it('linux/windows - should not flash frame when config item is not set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
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
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(mainWindow.flashFrame).not.toBeCalled();
        });

        it('linux/windows - should flash frame when config item is set', () => {
            Config.notifications = {
                flashWindow: true,
            };
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
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
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(mainWindow.flashFrame).toBeCalledWith(true);
        });

        it('mac - should not bounce icon when config item is not set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
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
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(app.dock.bounce).not.toBeCalled();
        });

        it('mac - should bounce icon when config item is set', () => {
            Config.notifications = {
                bounceIcon: true,
                bounceIconType: 'critical',
            };
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
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
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(app.dock.bounce).toHaveBeenCalledWith('critical');
        });
    });

    describe('displayDownloadCompleted', () => {
        beforeEach(() => {
            Notification.isSupported.mockImplementation(() => true);
            getFocusAssist.mockReturnValue({value: false});
            getDarwinDoNotDisturb.mockReturnValue(false);
        });

        it('should open file when clicked', () => {
            getDarwinDoNotDisturb.mockReturnValue(false);
            localizeMessage.mockReturnValue('test_filename');
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
