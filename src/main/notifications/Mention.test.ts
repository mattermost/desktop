// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import os from 'os';

import notMockedUtils from 'common/utils/util';

import {Mention} from './Mention';

let mockCapturedConstructorOptions: any = null;
let mockUuidCounter = 0;

jest.mock('electron', () => {
    const NotificationMock = jest.fn().mockImplementation(function(this: any, options: any) {
        mockCapturedConstructorOptions = {...options};
        this.callbackMap = new Map();
        this.on = jest.fn();
        this.show = jest.fn();
        this.close = jest.fn();
    });
    return {
        app: {getAppPath: () => '/path/to/app'},
        Notification: NotificationMock,
    };
});

jest.mock('electron-is-dev', () => false);

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn().mockReturnValue(''),
}));

jest.mock('uuid', () => ({
    v4: jest.fn().mockImplementation(() => `uid-${++mockUuidCounter}`),
}));

jest.mock('os', () => ({
    ...jest.requireActual('os'),
    release: jest.fn(),
}));

jest.mock('common/utils/util', () => ({
    __esModule: true,
    default: {
        isVersionGreaterThanOrEqualTo: jest.fn(),
    },
}));

const Utils = jest.mocked(notMockedUtils);

describe('main/notifications/Mention', () => {
    let originalPlatform: NodeJS.Platform;

    beforeEach(() => {
        originalPlatform = process.platform;
        mockCapturedConstructorOptions = null;
        mockUuidCounter = 0;
        jest.clearAllMocks();
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {value: originalPlatform});
    });

    describe('sound selection', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {value: 'linux'});
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(false);
        });

        it('MN-01: should return soundName when silent=false and soundName is provided', () => {
            const mention = new Mention(
                {title: 'test', body: 'body', silent: false, soundName: 'Bing'},
                'ch-1',
                'tm-1',
            );
            expect(mention.getNotificationSound()).toBe('Bing');
        });

        it('MN-02: should return empty string when silent=true (no sound should play)', () => {
            const mention = new Mention(
                {title: 'test', body: 'body', silent: true, soundName: 'Bing'},
                'ch-1',
                'tm-1',
            );
            expect(mention.getNotificationSound()).toBe('');
        });

        it('MN-03: should return empty string when soundName is "None" (no sound should play)', () => {
            const mention = new Mention(
                {title: 'test', body: 'body', silent: false, soundName: 'None'},
                'ch-1',
                'tm-1',
            );
            expect(mention.getNotificationSound()).toBe('');
        });

        it('MN-04: should construct Notification with silent=true when a custom sound is present', () => {
            // eslint-disable-next-line no-new
            new Mention(
                {title: 'test', body: 'body', silent: false, soundName: 'Bing'},
                'ch-1',
                'tm-1',
            );
            expect(mockCapturedConstructorOptions.silent).toBe(true);
        });
    });

    describe('icon stripping', () => {
        it('MN-05: should strip icon on macOS', () => {
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(true);
            // eslint-disable-next-line no-new
            new Mention(
                {title: 'test', body: 'body', silent: false, soundName: ''},
                'ch-1',
                'tm-1',
            );
            expect(mockCapturedConstructorOptions).not.toHaveProperty('icon');
        });

        it('MN-06: should strip icon on Windows 10+', () => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
            (os.release as jest.Mock).mockReturnValue('10.0.19041');
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(true);
            // eslint-disable-next-line no-new
            new Mention(
                {title: 'test', body: 'body', silent: false, soundName: ''},
                'ch-1',
                'tm-1',
            );
            expect(mockCapturedConstructorOptions).not.toHaveProperty('icon');
        });

        it('MN-07: should fall back to "Ding" on Windows 7 with no soundName and silent=false', () => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
            (os.release as jest.Mock).mockReturnValue('6.1.7601');
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(false);
            const mention = new Mention(
                {title: 'test', body: 'body', silent: false, soundName: ''},
                'ch-1',
                'tm-1',
            );
            expect(mention.getNotificationSound()).toBe('Ding');
        });
    });

    describe('instance properties', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {value: 'linux'});
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(false);
        });

        it('MN-08: should generate distinct uIds for different instances', () => {
            const m1 = new Mention(
                {title: 'test', body: 'body', silent: false, soundName: ''},
                'ch-1',
                'tm-1',
            );
            const m2 = new Mention(
                {title: 'test', body: 'body', silent: false, soundName: ''},
                'ch-2',
                'tm-2',
            );
            expect(m1.uId).not.toBe(m2.uId);
        });

        it('MN-09: should store channelId and teamId on the instance', () => {
            const mention = new Mention(
                {title: 'test', body: 'body', silent: false, soundName: ''},
                'ch-1',
                'tm-1',
            );
            expect(mention.channelId).toBe('ch-1');
            expect(mention.teamId).toBe('tm-1');
        });
    });
});
