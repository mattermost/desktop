// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {localizeMessage as notMockedLocalizeMessage} from 'main/i18nManager';

import {NewVersionNotification, UpgradeNotification} from './Upgrade';

const mockCapturedOptions: any[] = [];

jest.mock('electron', () => ({
    app: {getAppPath: () => '/path/to/app'},
    Notification: jest.fn().mockImplementation(function(this: any, opts: any) {
        mockCapturedOptions.push({...opts});
    }),
}));

jest.mock('electron-is-dev', () => false);

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn().mockReturnValue(''),
}));

const localizeMessage = jest.mocked(notMockedLocalizeMessage);

describe('main/notifications/Upgrade', () => {
    let originalPlatform: NodeJS.Platform;

    beforeEach(() => {
        originalPlatform = process.platform;
        mockCapturedOptions.length = 0;
        jest.clearAllMocks();
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {value: originalPlatform, configurable: true});
    });

    describe('NewVersionNotification', () => {
        it('UV-01: should strip icon on macOS', () => {
            Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true});
            // eslint-disable-next-line no-new
            new NewVersionNotification();
            expect(mockCapturedOptions[0]).not.toHaveProperty('icon');
        });

        it('UV-02: should include icon on Windows', () => {
            Object.defineProperty(process, 'platform', {value: 'win32', configurable: true});
            // eslint-disable-next-line no-new
            new NewVersionNotification();
            expect(mockCapturedOptions[0]).toHaveProperty('icon');
        });

        it('UV-03: should preserve icon on Linux', () => {
            Object.defineProperty(process, 'platform', {value: 'linux', configurable: true});
            // eslint-disable-next-line no-new
            new NewVersionNotification();
            expect(mockCapturedOptions[0]).toHaveProperty('icon');
        });
    });

    describe('UpgradeNotification', () => {
        it('UV-04: should use "ready to install" localization keys', () => {
            Object.defineProperty(process, 'platform', {value: 'linux', configurable: true});
            // eslint-disable-next-line no-new
            new UpgradeNotification();
            expect(localizeMessage).toHaveBeenCalledWith(
                'main.notifications.upgrade.readyToInstall.title',
                expect.any(String),
            );
            expect(localizeMessage).toHaveBeenCalledWith(
                'main.notifications.upgrade.readyToInstall.body',
                expect.any(String),
            );
        });

        it('UV-05: should strip icon on macOS', () => {
            Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true});
            // eslint-disable-next-line no-new
            new UpgradeNotification();
            expect(mockCapturedOptions[0]).not.toHaveProperty('icon');
        });

        it('UV-06: should include icon on Windows', () => {
            Object.defineProperty(process, 'platform', {value: 'win32', configurable: true});
            // eslint-disable-next-line no-new
            new UpgradeNotification();
            expect(mockCapturedOptions[0]).toHaveProperty('icon');
        });
    });
});
