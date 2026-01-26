// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain as notMockedIpcMain, app as notMockedApp, net as notMockedNet} from 'electron';

import {
    CHECK_FOR_UPDATES,
    UPDATE_AVAILABLE,
    NO_UPDATE_AVAILABLE,
    UPDATE_SHORTCUT_MENU,
} from 'common/communication';
import NotificationManager from 'main/notifications';

import {UpdateNotifier} from './updateNotifier';

const ipcMain = jest.mocked(notMockedIpcMain);
const app = jest.mocked(notMockedApp);
jest.mocked(notMockedNet);

jest.mock('electron', () => ({
    app: {
        getAppPath: jest.fn(() => '/path/to/app'),
        getVersion: jest.fn(() => '5.0.0'),
        name: 'Mattermost',
    },
    nativeImage: {
        createFromPath: jest.fn(),
    },
    ipcMain: {
        on: jest.fn(),
        emit: jest.fn(),
        handle: jest.fn(),
    },
    dialog: {
        showMessageBox: jest.fn(),
    },
    shell: {
        openExternal: jest.fn(),
    },
    net: {
        fetch: jest.fn(),
    },
}));

jest.mock('common/config', () => ({
    canUpgrade: true,
}));

jest.mock('common/config/buildConfig', () => ({
    default: {
        updateNotificationURL: 'https://releases.mattermost.com/desktop',
    },
}));

jest.mock('main/notifications', () => ({
    displayUpgrade: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn((key: string, defaultValue: string) => defaultValue),
}));

jest.mock('common/log', () => ({
    Logger: jest.fn().mockImplementation(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    })),
}));

jest.mock('electron-is-dev', () => ({
    __esModule: true,
    default: false,
}));

jest.mock('main/downloadsManager', () => ({
    removeUpdateBeforeRestart: jest.fn(),
}));

const net = jest.mocked(notMockedNet);

describe('main/updateNotifier', () => {
    describe('constructor', () => {
        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should register IPC listeners', () => {
            const updateNotifier = new UpdateNotifier();
            expect(updateNotifier).toBeDefined();
            expect(ipcMain.on).toHaveBeenCalledWith(CHECK_FOR_UPDATES, expect.any(Function));
        });

        it('should check for updates when CHECK_FOR_UPDATES is emitted', () => {
            let checkCallback: (() => void) | undefined;
            ipcMain.on.mockImplementation((event, callback) => {
                if (event === CHECK_FOR_UPDATES) {
                    checkCallback = callback as () => void;
                }
                return ipcMain;
            });

            const updateNotifier = new UpdateNotifier();
            updateNotifier.checkForUpdates = jest.fn();
            checkCallback?.();

            expect(updateNotifier.checkForUpdates).toHaveBeenCalledWith(true);
        });
    });

    describe('onUpdateAvailable', () => {
        it('should set version and notify', () => {
            const updateNotifier = new UpdateNotifier();
            updateNotifier.notify = jest.fn();

            updateNotifier.onUpdateAvailable({version: '5.1.0'});

            expect(updateNotifier.versionAvailable).toBe('5.1.0');
            expect(ipcMain.emit).toHaveBeenCalledWith(UPDATE_SHORTCUT_MENU);
            expect(updateNotifier.notify).toHaveBeenCalled();
        });
    });

    describe('notify', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should schedule next notification', () => {
            const updateNotifier = new UpdateNotifier();
            updateNotifier.notifyUpgrade = jest.fn();
            updateNotifier.notify();
            expect(updateNotifier.lastNotification).toBeDefined();
            if (updateNotifier.lastNotification) {
                clearTimeout(updateNotifier.lastNotification);
            }
        });

        it('should display upgrade notification when version is available', () => {
            const updateNotifier = new UpdateNotifier();
            updateNotifier.versionAvailable = '5.1.0';
            updateNotifier.notify();

            expect(ipcMain.emit).toHaveBeenCalledWith(UPDATE_AVAILABLE, null, '5.1.0');
            expect(NotificationManager.displayUpgrade).toHaveBeenCalledWith('5.1.0', expect.any(Function));
        });
    });

    describe('checkForUpdates', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.resetAllMocks();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should return early if updates are disabled', () => {
            const Config = require('common/config');
            Config.canUpgrade = false;

            const updateNotifier = new UpdateNotifier();
            const performUpdateCheckSpy = jest.spyOn(updateNotifier, 'performUpdateCheck');
            updateNotifier.checkForUpdates(true);

            expect(performUpdateCheckSpy).not.toHaveBeenCalled();

            Config.canUpgrade = true;
            performUpdateCheckSpy.mockRestore();
        });

        it('should call performUpdateCheck and handle update available', async () => {
            const updateNotifier = new UpdateNotifier();
            updateNotifier.onUpdateAvailable = jest.fn();
            jest.spyOn(updateNotifier, 'performUpdateCheck').mockResolvedValue({version: '5.1.0'});

            updateNotifier.checkForUpdates(true);
            await Promise.resolve();

            expect(updateNotifier.performUpdateCheck).toHaveBeenCalledWith(true);
            expect(updateNotifier.onUpdateAvailable).toHaveBeenCalledWith({version: '5.1.0'});
        });

        it('should emit NO_UPDATE_AVAILABLE when no update is found', async () => {
            const updateNotifier = new UpdateNotifier();
            updateNotifier.displayNoUpgrade = jest.fn();
            jest.spyOn(updateNotifier, 'performUpdateCheck').mockResolvedValue(null);

            updateNotifier.checkForUpdates(true);
            await Promise.resolve();

            expect(ipcMain.emit).toHaveBeenCalledWith(NO_UPDATE_AVAILABLE);
            expect(updateNotifier.displayNoUpgrade).toHaveBeenCalled();
        });

        it('should schedule next check', () => {
            const updateNotifier = new UpdateNotifier();
            jest.spyOn(updateNotifier, 'performUpdateCheck').mockResolvedValue(null);
            const checkForUpdatesSpy = jest.spyOn(updateNotifier, 'checkForUpdates');
            updateNotifier.checkForUpdates(false);
            jest.advanceTimersByTime(3600000);
            expect(checkForUpdatesSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('performUpdateCheck', () => {
        beforeEach(() => {
            jest.resetAllMocks();
        });

        it('should return update info', async () => {
            app.getVersion.mockReturnValue('5.0.0');
            const mockResponse = {
                ok: true,
                text: jest.fn().mockResolvedValue('6.1.0-develop.2\n'),
            } as unknown as Response;
            net.fetch.mockResolvedValue(mockResponse);
            const updateNotifier = new UpdateNotifier();
            const result = await updateNotifier.performUpdateCheck(false);
            expect(result).toEqual({version: '6.1.0-develop.2'});
        });
    });
});
