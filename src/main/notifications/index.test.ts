// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';
import notMockedCP from 'child_process';

import type {BrowserWindow, IpcMain, IpcMainEvent, WebContents} from 'electron';
import {Notification as NotMockedNotification, shell, app, ipcMain as NotMockedIpcMain} from 'electron';
import {getDoNotDisturb as notMockedGetDarwinDoNotDisturb} from 'macos-notification-state';
import {getFocusAssist as notMockedGetFocusAssist} from 'windows-focus-assist';

import {PLAY_SOUND} from 'common/communication';
import notMockedConfig from 'common/config';
import {localizeMessage as notMockedLocalizeMessage} from 'main/i18nManager';
import notMockedPermissionsManager from 'main/permissionsManager';
import ViewManager from 'main/views/viewManager';
import notMockedMainWindow from 'main/windows/mainWindow';

import getLinuxDoNotDisturb from './dnd-linux';

import NotificationManager from './index';

const Notification = jest.mocked(NotMockedNotification);
const getFocusAssist = jest.mocked(notMockedGetFocusAssist);
const PermissionsManager = jest.mocked(notMockedPermissionsManager);
const getDarwinDoNotDisturb = jest.mocked(notMockedGetDarwinDoNotDisturb);
const Config = jest.mocked(notMockedConfig);
const MainWindow = jest.mocked(notMockedMainWindow);
const localizeMessage = jest.mocked(notMockedLocalizeMessage);
const cp = jest.mocked(notMockedCP);
const ipcMain = jest.mocked(NotMockedIpcMain);

const mentions: Array<{body: string; value: any}> = [];

jest.mock('child_process', () => ({
    execSync: jest.fn(),
}));
jest.mock('electron-is-dev', () => false);
jest.mock('electron', () => {
    class NotificationMock {
        callbackMap: Map<string, () => void>;
        static isSupported = jest.fn();
        static didConstruct = jest.fn();

        constructor(options: any) {
            NotificationMock.didConstruct();
            this.callbackMap = new Map();
            mentions.push({body: options.body, value: this});
        }

        on = (event: string, callback: () => void) => {
            this.callbackMap.set(event, callback);
        };

        show = jest.fn().mockImplementation(() => {
            this.callbackMap.get('show')?.();
        });

        click = jest.fn().mockImplementation(() => {
            this.callbackMap.get('click')?.();
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
        ipcMain: {
            on: jest.fn(),
            off: jest.fn(),
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
                url: new URL('http://someurl.com'),
            },
            shouldNotify: true,
        },
    }),
    showById: jest.fn(),
}));
jest.mock('../windows/mainWindow', () => ({
    get: jest.fn(),
    show: jest.fn(),
    sendToRenderer: jest.fn(),
}));
jest.mock('main/developerMode', () => ({
    switchOff: (_: string, onStart: () => void) => onStart(),
}));
jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));
jest.mock('main/permissionsManager', () => ({
    doPermissionRequest: jest.fn(),
}));

jest.mock('common/config', () => ({}));

describe('main/notifications', () => {
    describe('displayMention', () => {
        const mainWindow = {
            flashFrame: jest.fn(),
        } as unknown as BrowserWindow;

        beforeEach(() => {
            PermissionsManager.doPermissionRequest.mockReturnValue(Promise.resolve(true));
            Notification.isSupported.mockImplementation(() => true);
            getFocusAssist.mockReturnValue({value: 0, name: ''});
            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(false));
            Config.notifications = {
                flashWindow: 0,
                bounceIcon: false,
                bounceIconType: 'informational',
            };
            MainWindow.get.mockReturnValue(mainWindow);
        });

        afterEach(() => {
            jest.resetAllMocks();
            mentions.length = 0;
            Config.notifications = {
                flashWindow: 0,
                bounceIcon: false,
                bounceIconType: 'informational',
            };
        });

        it('should do nothing when Notification is not supported', async () => {
            Notification.isSupported.mockImplementation(() => false);
            await NotificationManager.displayMention(
                'test',
                'test body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1} as WebContents,
                '',
            );
            expect(mentions.length).toBe(0);
        });

        it('should do nothing when alarms only is enabled on windows', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            getFocusAssist.mockReturnValue({value: 2, name: ''});
            await NotificationManager.displayMention(
                'test',
                'test body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1} as WebContents,
                '',
            );
            expect(mentions.length).toBe(0);

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should do nothing when dnd is enabled on mac', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(true));
            await NotificationManager.displayMention(
                'test',
                'test body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1} as WebContents,
                '',
            );
            expect(mentions.length).toBe(0);

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should still show notification when dnd permission on mac is not authorized', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            getDarwinDoNotDisturb.mockImplementation(() => {
                throw new Error('Unauthorized');
            });
            await NotificationManager.displayMention(
                'test',
                'test body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1} as WebContents,
                '',
            );
            expect(mentions.length).toBe(1);
            const mention = mentions[0];
            expect(mention.value.show).toHaveBeenCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should do nothing when the permission check fails', async () => {
            PermissionsManager.doPermissionRequest.mockReturnValue(Promise.resolve(false));
            await NotificationManager.displayMention(
                'test',
                'test body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1} as WebContents,
                '',
            );
            expect(mentions.length).toBe(0);
        });

        it('should play notification sound when custom sound is provided', async () => {
            await NotificationManager.displayMention(
                'test',
                'test body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1} as WebContents,
                'test_sound',
            );
            expect(MainWindow.sendToRenderer).toHaveBeenCalledWith(PLAY_SOUND, 'test_sound');
        });

        it('should remove existing notification from the same channel/team on windows', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            await NotificationManager.displayMention(
                'test',
                'test body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1} as WebContents,
                '',
            );

            // convert to any to access private field
            const mentionsPerChannel = (NotificationManager as any).mentionsPerChannel;
            expect(mentionsPerChannel.has('team_id:channel_id')).toBe(true);

            const existingMention = mentionsPerChannel.get('team_id:channel_id');
            mentionsPerChannel.delete = jest.fn();
            await NotificationManager.displayMention(
                'test',
                'test body 2',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1} as WebContents,
                '',
            );

            expect(mentionsPerChannel.delete).toHaveBeenCalled();
            expect(existingMention?.close).toHaveBeenCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should switch view when clicking on notification, but after the navigation has happened', async () => {
            let listener: (event: IpcMainEvent, ...args: any[]) => void;
            ipcMain.on.mockImplementation((channel: string, cb: (event: IpcMainEvent, ...args: any[]) => void): IpcMain => {
                listener = cb;
                return ipcMain;
            });
            await NotificationManager.displayMention(
                'click_test',
                'mention_click_body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1, send: jest.fn()} as unknown as WebContents,
                '',
            );
            const mention = mentions.find((m) => m.body === 'mention_click_body');
            mention?.value.click();
            expect(MainWindow.show).not.toHaveBeenCalled();
            expect(ViewManager.showById).not.toHaveBeenCalledWith('server_id');

            // @ts-expect-error "Set by the click handler"
            listener?.({} as unknown as IpcMainEvent);

            expect(MainWindow.show).toHaveBeenCalled();
            expect(ViewManager.showById).toHaveBeenCalledWith('server_id');
        });

        it('linux/windows - should not flash frame when config item is not set', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            await NotificationManager.displayMention(
                'click_test',
                'mention_click_body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1, send: jest.fn()} as unknown as WebContents,
                '',
            );
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(mainWindow.flashFrame).not.toBeCalled();
        });

        it('linux/windows - should flash frame when config item is set', async () => {
            Config.notifications = {
                flashWindow: 1,
                bounceIcon: false,
                bounceIconType: 'informational',
            };
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            await NotificationManager.displayMention(
                'click_test',
                'mention_click_body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1, send: jest.fn()} as unknown as WebContents,
                '',
            );
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(mainWindow.flashFrame).toBeCalledWith(true);
        });

        it('mac - should not bounce icon when config item is not set', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            await NotificationManager.displayMention(
                'click_test',
                'mention_click_body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1, send: jest.fn()} as unknown as WebContents,
                '',
            );
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(app.dock!.bounce).not.toBeCalled();
        });

        it('mac - should bounce icon when config item is set', async () => {
            Config.notifications = {
                bounceIcon: true,
                bounceIconType: 'critical',
                flashWindow: 0,
            };
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            await NotificationManager.displayMention(
                'click_test',
                'mention_click_body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1, send: jest.fn()} as unknown as WebContents,
                '',
            );
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(app.dock!.bounce).toHaveBeenCalledWith('critical');
        });
    });

    describe('displayDownloadCompleted', () => {
        beforeEach(() => {
            Notification.isSupported.mockImplementation(() => true);
            getFocusAssist.mockReturnValue({value: 0, name: ''});
            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(false));
        });

        it('should open file when clicked', async () => {
            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(false));
            localizeMessage.mockReturnValue('test_filename');
            await NotificationManager.displayDownloadCompleted(
                'test_filename',
                '/path/to/file',
                'server_name',
            );
            const mention = mentions.find((m) => m.body.includes('test_filename'));
            mention?.value.click();
            expect(shell.showItemInFolder).toHaveBeenCalledWith('/path/to/file');
        });
    });

    describe('getLinuxDoNotDisturb', () => {
        let originalPlatform: NodeJS.Platform;
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
            cp.execSync.mockReturnValue(Buffer.from('true'));
            expect(getLinuxDoNotDisturb()).toBe(false);
        });

        it('should return false if error is thrown', () => {
            cp.execSync.mockImplementation(() => {
                throw Error('error');
            });
            expect(getLinuxDoNotDisturb()).toBe(false);
        });

        it('should return true', () => {
            cp.execSync.mockReturnValue(Buffer.from('false'));
            expect(getLinuxDoNotDisturb()).toBe(true);
        });
    });
});
