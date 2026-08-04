// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import notMockedUtils from 'common/utils/util';
import {localizeMessage as notMockedLocalizeMessage} from 'main/i18nManager';

import {DownloadNotification} from './Download';

const mockCapturedOptions: any[] = [];
let mockUuidCounter = 0;

jest.mock('electron', () => ({
    app: {getAppPath: () => '/path/to/app'},
    Notification: jest.fn().mockImplementation(function(this: any, opts: any) {
        mockCapturedOptions.push({...opts});
    }),
}));

jest.mock('electron-is-dev', () => false);

jest.mock('uuid', () => ({
    v4: jest.fn().mockImplementation(() => `dl-uid-${++mockUuidCounter}`),
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

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

const localizeMessage = jest.mocked(notMockedLocalizeMessage);
const Utils = jest.mocked(notMockedUtils);

describe('main/notifications/DownloadNotification', () => {
    let originalPlatform: NodeJS.Platform;

    beforeEach(() => {
        originalPlatform = process.platform;
        mockCapturedOptions.length = 0;
        mockUuidCounter = 0;
        jest.clearAllMocks();
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {value: originalPlatform});
    });

    describe('Linux/macOS title and body', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {value: 'linux'});
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(false);
        });

        it('DL-01: should use localized "Download Complete" title on Linux', () => {
            // eslint-disable-next-line no-new
            new DownloadNotification('test-file.zip', 'My Server');
            expect(localizeMessage).toHaveBeenCalledWith(
                'main.notifications.download.complete.title',
                expect.any(String),
            );
        });

        it('DL-02: should use raw fileName as body on Linux', () => {
            localizeMessage.mockReturnValue('Download Complete');
            // eslint-disable-next-line no-new
            new DownloadNotification('test-file.zip', 'My Server');
            expect(mockCapturedOptions[0].body).toBe('test-file.zip');
        });
    });

    describe('Windows title and body', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(true);
        });

        it('DL-03: should use serverName as title on Windows', () => {
            localizeMessage.mockReturnValue('Download Complete\ntest-file.zip');
            // eslint-disable-next-line no-new
            new DownloadNotification('test-file.zip', 'My Server');
            expect(mockCapturedOptions[0].title).toBe('My Server');
        });

        it('DL-04: should use localized body with fileName interpolated on Windows', () => {
            // eslint-disable-next-line no-new
            new DownloadNotification('test-file.zip', 'My Server');
            expect(localizeMessage).toHaveBeenCalledWith(
                'main.notifications.download.complete.body',
                expect.any(String),
                {fileName: 'test-file.zip'},
            );
        });
    });

    describe('icon handling', () => {
        it('DL-05: should strip icon on macOS', () => {
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(true);
            // eslint-disable-next-line no-new
            new DownloadNotification('file.zip', 'server');
            expect(mockCapturedOptions[0]).not.toHaveProperty('icon');
        });

        it('DL-06: should strip icon on Windows 10+', () => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(true);
            localizeMessage.mockReturnValue('');
            // eslint-disable-next-line no-new
            new DownloadNotification('file.zip', 'server');
            expect(mockCapturedOptions[0]).not.toHaveProperty('icon');
        });

        it('DL-07: should preserve icon on Linux', () => {
            Object.defineProperty(process, 'platform', {value: 'linux'});
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(false);
            localizeMessage.mockReturnValue('Download Complete');
            // eslint-disable-next-line no-new
            new DownloadNotification('file.zip', 'server');
            expect(mockCapturedOptions[0]).toHaveProperty('icon');
        });
    });

    it('DL-08: should generate distinct uIds for different instances', () => {
        Object.defineProperty(process, 'platform', {value: 'linux'});
        Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(false);
        localizeMessage.mockReturnValue('Download Complete');
        const dl1 = new DownloadNotification('file1.zip', 'server');
        const dl2 = new DownloadNotification('file2.zip', 'server');
        expect(dl1.uId).not.toBe(dl2.uId);
    });
});
