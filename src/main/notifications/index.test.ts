// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';
import notMockedCP from 'child_process';

import type {BrowserWindow, IpcMain, IpcMainEvent, WebContents} from 'electron';
import {Notification as NotMockedNotification, shell, app, ipcMain as NotMockedIpcMain} from 'electron';
import {getDoNotDisturb as notMockedGetDarwinDoNotDisturb} from 'macos-notification-state';
import {getFocusAssist as notMockedGetFocusAssist, isPriority as notMockedIsPriority} from 'windows-focus-assist';

import notMockedMainWindow from 'app/mainWindow/mainWindow';
import TabManager from 'app/tabs/tabManager';
import notMockedWebContentsManager from 'app/views/webContentsManager';
import {PLAY_SOUND, NOTIFICATION_CLICKED} from 'common/communication';
import notMockedConfig from 'common/config';
import notMockedServerManager from 'common/servers/serverManager';
import notMockedViewManager from 'common/views/viewManager';
import {localizeMessage as notMockedLocalizeMessage} from 'main/i18nManager';
import notMockedPermissionsManager from 'main/security/permissionsManager';

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
const WebContentsManager = jest.mocked(notMockedWebContentsManager);
const ServerManager = jest.mocked(notMockedServerManager);
const ViewManager = jest.mocked(notMockedViewManager);

const mentions: Array<{body: string; value: any}> = [];
let mockBlockShow = false;
const mockNotificationConstruct = jest.fn();
const isPriority = jest.mocked(notMockedIsPriority);

jest.mock('child_process', () => ({
    execSync: jest.fn(),
}));
jest.mock('electron-is-dev', () => false);
jest.mock('electron', () => {
    class NotificationMock {
        callbackMap: Map<string, () => void>;
        static isSupported = jest.fn();

        constructor(options: any) {
            mockNotificationConstruct();
            this.callbackMap = new Map();
            mentions.push({body: options.body, value: this});
        }

        on = (event: string, callback: () => void) => {
            this.callbackMap.set(event, callback);
        };

        show = jest.fn().mockImplementation(() => {
            if (!mockBlockShow) {
                this.callbackMap.get('show')?.();
            }
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
            handle: jest.fn(),
        },
        Notification: NotificationMock,
        shell: {
            showItemInFolder: jest.fn(),
        },
    };
});

jest.mock('windows-focus-assist', () => ({
    getFocusAssist: jest.fn(),
    isPriority: jest.fn(),
}));

jest.mock('macos-notification-state', () => ({
    getDoNotDisturb: jest.fn(),
}));
jest.mock('common/views/viewManager', () => ({
    getViewByWebContentsId: jest.fn(),
    showById: jest.fn(),
    isPrimaryView: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
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
jest.mock('main/security/permissionsManager', () => ({
    doPermissionRequest: jest.fn(),
}));

jest.mock('app/tabs/tabManager', () => ({
    on: jest.fn(),
    switchToTab: jest.fn(),
}));

jest.mock('app/views/webContentsManager', () => ({
    getViewByWebContentsId: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    getServer: jest.fn(),
}));

jest.mock('main/security/permissionsManager', () => ({
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

            // Setup mocks for the notification flow
            const mockView = {
                id: 'view-1',
                serverId: 'server-1',
            } as any;
            const mockServer = {
                id: 'server-1',
                name: 'Test Server',
                url: 'http://server-1.com',
            } as any;

            WebContentsManager.getViewByWebContentsId.mockReturnValue(mockView);
            ServerManager.getServer.mockReturnValue(mockServer);
            ViewManager.isPrimaryView.mockReturnValue(true);
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
            expect(TabManager.switchToTab).not.toHaveBeenCalledWith('view-1');

            // @ts-expect-error "Set by the click handler"
            listener?.({} as unknown as IpcMainEvent);

            expect(MainWindow.show).toHaveBeenCalled();
            expect(TabManager.switchToTab).toHaveBeenCalledWith('view-1');
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

        it('should not send notification when view is not primary', async () => {
            ViewManager.isPrimaryView.mockReturnValue(false);

            const result = await NotificationManager.displayMention(
                'test',
                'test body',
                'channel_id',
                'team_id',
                'http://server-1.com/team_id/channel_id',
                false,
                {id: 1} as WebContents,
                '',
            );

            expect(result).toEqual({status: 'not_sent', reason: 'view_should_not_notify'});
            expect(mentions.length).toBe(0);
        });

        it('NM-01: should return error when view is not found', async () => {
            WebContentsManager.getViewByWebContentsId.mockReturnValue(undefined);
            const result = await NotificationManager.displayMention(
                'test', 'test body', 'channel_id', 'team_id',
                'http://server-1.com/team_id/channel_id', false,
                {id: 1} as WebContents, '',
            );
            expect(result).toEqual({status: 'error', reason: 'missing_view'});
            expect(mentions.length).toBe(0);
        });

        it('NM-02: should return error when server is not found', async () => {
            ServerManager.getServer.mockReturnValue(undefined);
            const result = await NotificationManager.displayMention(
                'test', 'test body', 'channel_id', 'team_id',
                'http://server-1.com/team_id/channel_id', false,
                {id: 1} as WebContents, '',
            );
            expect(result).toEqual({status: 'error', reason: 'missing_server'});
            expect(mentions.length).toBe(0);
        });

        it('NM-03: should not send PLAY_SOUND when silent=true', async () => {
            await NotificationManager.displayMention(
                'test', 'test body', 'channel_id', 'team_id',
                'http://server-1.com/team_id/channel_id', true,
                {id: 1} as WebContents, '',
            );
            expect(MainWindow.sendToRenderer).not.toHaveBeenCalledWith(PLAY_SOUND, expect.anything());
        });

        it('NM-04: should not send PLAY_SOUND when soundName is "None"', async () => {
            await NotificationManager.displayMention(
                'test', 'test body', 'channel_id', 'team_id',
                'http://server-1.com/team_id/channel_id', false,
                {id: 1} as WebContents, 'None',
            );
            expect(MainWindow.sendToRenderer).not.toHaveBeenCalledWith(PLAY_SOUND, expect.anything());
        });

        describe('notification failed events', () => {
            beforeEach(() => {
                mockBlockShow = true;
            });

            afterEach(() => {
                mockBlockShow = false;
            });

            it('NM-05: should return electron_notification_failed on generic failed error', async () => {
                const promise = NotificationManager.displayMention(
                    'test', 'test body', 'channel_id', 'team_id',
                    'http://server-1.com/team_id/channel_id', false,
                    {id: 1} as WebContents, '',
                );
                await new Promise(setImmediate);
                mentions[0].value.callbackMap.get('failed')?.(null, 'some error');
                const result = await promise;
                expect(result).toEqual({status: 'error', reason: 'electron_notification_failed', data: 'some error'});
            });

            it('NM-06: should return windows_permissions_denied on HRESULT error', async () => {
                const promise = NotificationManager.displayMention(
                    'test', 'test body', 'channel_id', 'team_id',
                    'http://server-1.com/team_id/channel_id', false,
                    {id: 1} as WebContents, '',
                );
                await new Promise(setImmediate);
                mentions[0].value.callbackMap.get('failed')?.(null, 'Error: HRESULT:-2143420143');
                const result = await promise;
                expect(result).toEqual({status: 'not_sent', reason: 'windows_permissions_denied'});
            });
        });

        describe('notification timeout', () => {
            beforeEach(() => {
                mockBlockShow = true;
                jest.useFakeTimers({doNotFake: ['setImmediate']});
            });

            afterEach(() => {
                mockBlockShow = false;
                jest.useRealTimers();
            });

            it('NM-07: should resolve with notification_timeout after 10s if show never fires', async () => {
                const promise = NotificationManager.displayMention(
                    'test', 'test body', 'channel_id', 'team_id',
                    'http://server-1.com/team_id/channel_id', false,
                    {id: 1} as WebContents, '',
                );
                await new Promise(setImmediate);
                jest.advanceTimersByTime(10000);
                const result = await promise;
                expect(result).toEqual({status: 'error', reason: 'notification_timeout'});
            });
        });

        it('NM-08: should remove mention from allActiveNotifications when close event fires', async () => {
            await NotificationManager.displayMention(
                'test', 'test body', 'channel_id', 'team_id',
                'http://server-1.com/team_id/channel_id', false,
                {id: 1} as WebContents, '',
            );
            const mention = mentions[0];
            const uId = mention.value.uId;
            const allActive = (NotificationManager as any).allActiveNotifications as Map<string, any>;
            expect(allActive.has(uId)).toBe(true);
            mention.value.callbackMap.get('close')?.();
            expect(allActive.has(uId)).toBe(false);
        });

        it('NM-09: should send NOTIFICATION_CLICKED with channelId, teamId, and url when clicked', async () => {
            const webcontents = {id: 1, send: jest.fn()} as unknown as WebContents;
            const url = 'http://server-1.com/team_id/channel_id';
            await NotificationManager.displayMention(
                'test', 'test body', 'channel_id', 'team_id', url, false, webcontents, '',
            );
            const mention = mentions[0];
            mention.value.callbackMap.get('click')?.();
            expect(webcontents.send).toHaveBeenCalledWith(NOTIFICATION_CLICKED, 'channel_id', 'team_id', url);
        });

        it('NM-10: should suppress notification when Linux DND is active', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'linux'});
            cp.execSync.mockReturnValue(Buffer.from('false'));
            await NotificationManager.displayMention(
                'test', 'test body', 'channel_id', 'team_id',
                'http://server-1.com/team_id/channel_id', false,
                {id: 1} as WebContents, '',
            );
            expect(mentions.length).toBe(0);
            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });

        it('NM-11: should suppress notification on Windows Priority Only when app is not priority', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'win32'});
            getFocusAssist.mockReturnValue({value: 1, name: ''});
            isPriority.mockReturnValue({value: 0, name: ''});
            await NotificationManager.displayMention(
                'test', 'test body', 'channel_id', 'team_id',
                'http://server-1.com/team_id/channel_id', false,
                {id: 1} as WebContents, '',
            );
            expect(mentions.length).toBe(0);
            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });
    });

    describe('displayDownloadCompleted', () => {
        const dlMainWindow = {
            flashFrame: jest.fn(),
        } as unknown as BrowserWindow;

        beforeEach(() => {
            Notification.isSupported.mockImplementation(() => true);
            getFocusAssist.mockReturnValue({value: 0, name: ''});
            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(false));
            MainWindow.get.mockReturnValue(dlMainWindow);
        });

        afterEach(() => {
            jest.resetAllMocks();
            mentions.length = 0;
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

        it('DD-01: should not show notification when DND is active on macOS', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(true));
            await NotificationManager.displayDownloadCompleted('test.zip', '/path', 'server');
            expect(mockNotificationConstruct).not.toHaveBeenCalled();
            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });

        it('DD-02: should not show notification when Notification is not supported', async () => {
            Notification.isSupported.mockImplementation(() => false);
            await NotificationManager.displayDownloadCompleted('test.zip', '/path', 'server');
            expect(mockNotificationConstruct).not.toHaveBeenCalled();
        });

        it('DD-03: should flash frame on Linux when show fires and flashWindow config is set', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'linux'});
            Config.notifications = {flashWindow: 1, bounceIcon: false, bounceIconType: 'informational'};
            localizeMessage.mockReturnValue('test.zip');
            await NotificationManager.displayDownloadCompleted('test.zip', '/path', 'server');
            expect(dlMainWindow.flashFrame).toHaveBeenCalledWith(true);
            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });

        it('DD-04: should remove download from allActiveNotifications when close event fires', async () => {
            localizeMessage.mockReturnValue('test.zip');
            await NotificationManager.displayDownloadCompleted('test.zip', '/path', 'server');
            const download = mentions[0];
            const uId = download.value.uId;
            const allActive = (NotificationManager as any).allActiveNotifications as Map<string, any>;
            expect(allActive.has(uId)).toBe(true);
            download.value.callbackMap.get('close')?.();
            expect(allActive.has(uId)).toBe(false);
        });

        it('DD-05: should remove download from allActiveNotifications when failed event fires', async () => {
            localizeMessage.mockReturnValue('test.zip');
            await NotificationManager.displayDownloadCompleted('test.zip', '/path', 'server');
            const download = mentions[0];
            const uId = download.value.uId;
            const allActive = (NotificationManager as any).allActiveNotifications as Map<string, any>;
            expect(allActive.has(uId)).toBe(true);
            download.value.callbackMap.get('failed')?.();
            expect(allActive.has(uId)).toBe(false);
        });
    });

    describe('displayUpgrade', () => {
        beforeEach(() => {
            Notification.isSupported.mockImplementation(() => true);
            getFocusAssist.mockReturnValue({value: 0, name: ''});
            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(false));
        });

        afterEach(() => {
            jest.resetAllMocks();
            mentions.length = 0;
        });

        it('UV-07: should not show notification when Notification is not supported', async () => {
            Notification.isSupported.mockImplementation(() => false);
            await NotificationManager.displayUpgrade('1.0.0', jest.fn());
            expect(mockNotificationConstruct).not.toHaveBeenCalled();
        });

        it('UV-08: should not show notification when DND is active', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(true));
            await NotificationManager.displayUpgrade('1.0.0', jest.fn());
            expect(mockNotificationConstruct).not.toHaveBeenCalled();
            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });

        it('UV-09: should call handleUpgrade when upgrade notification is clicked', async () => {
            const handleUpgrade = jest.fn();
            await NotificationManager.displayUpgrade('1.0.0', handleUpgrade);
            mentions[0].value.callbackMap.get('click')?.();
            expect(handleUpgrade).toHaveBeenCalledTimes(1);
        });

        it('UV-10: should close existing upgrade notification when a second one is shown', async () => {
            await NotificationManager.displayUpgrade('1.0.0', jest.fn());
            const firstNotification = mentions[0];
            await NotificationManager.displayUpgrade('1.1.0', jest.fn());
            expect(firstNotification.value.close).toHaveBeenCalled();
        });
    });

    describe('displayRestartToUpgrade', () => {
        beforeEach(() => {
            Notification.isSupported.mockImplementation(() => true);
            getFocusAssist.mockReturnValue({value: 0, name: ''});
            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(false));
        });

        afterEach(() => {
            jest.resetAllMocks();
            mentions.length = 0;
        });

        it('UV-11: should not show notification when Notification is not supported', async () => {
            Notification.isSupported.mockImplementation(() => false);
            await NotificationManager.displayRestartToUpgrade('1.0.0', jest.fn());
            expect(mockNotificationConstruct).not.toHaveBeenCalled();
        });

        it('UV-12: should not show notification when DND is active', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            getDarwinDoNotDisturb.mockReturnValue(Promise.resolve(true));
            await NotificationManager.displayRestartToUpgrade('1.0.0', jest.fn());
            expect(mockNotificationConstruct).not.toHaveBeenCalled();
            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });

        it('UV-13: should call handleUpgrade when restart-to-upgrade notification is clicked', async () => {
            const handleUpgrade = jest.fn();
            await NotificationManager.displayRestartToUpgrade('1.0.0', handleUpgrade);
            mentions[0].value.callbackMap.get('click')?.();
            expect(handleUpgrade).toHaveBeenCalledTimes(1);
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
