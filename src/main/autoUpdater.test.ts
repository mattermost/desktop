// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain as notMockedIpcMain} from 'electron';
import {autoUpdater as notMockedAutoUpdater} from 'electron-updater';

import {CHECK_FOR_UPDATES} from 'common/communication';
import NotificationManager from 'main/notifications';

import {UpdateManager} from './autoUpdater';

const autoUpdater = jest.mocked(notMockedAutoUpdater);
const ipcMain = jest.mocked(notMockedIpcMain);

jest.mock('electron', () => ({
    app: {
        getAppPath: () => '/path/to/app',
    },
    nativeImage: {
        createFromPath: jest.fn(),
    },
    ipcMain: {
        on: jest.fn(),
        emit: jest.fn(),
    },
}));

jest.mock('electron-updater', () => ({
    autoUpdater: {
        on: jest.fn(),
        once: jest.fn(),
        removeListener: jest.fn(),
        quitAndInstall: jest.fn(),
        downloadUpdate: jest.fn(),
        checkForUpdates: jest.fn(),
    },
    CancellationToken: jest.fn().mockImplementation(() => {
        return {};
    }),
}));

jest.mock('common/config', () => ({
    canUpgrade: true,
}));

jest.mock('main/notifications', () => ({
    displayUpgrade: jest.fn(),
    displayRestartToUpgrade: jest.fn(),
}));

jest.mock('main/windows/mainWindow', () => ({
    sendToRenderer: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('main/downloadsManager', () => ({
    removeUpdateBeforeRestart: jest.fn(),
}));

describe('main/autoUpdater', () => {
    describe('constructor', () => {
        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should notify user on update-available', () => {
            let cb: any;
            autoUpdater.on.mockImplementation((event, callback) => {
                if (event === 'update-available') {
                    cb = callback;
                }
                return autoUpdater;
            });

            const updateManager = new UpdateManager();
            updateManager.notify = jest.fn();
            cb({version: '5.1.0'});

            expect(updateManager.versionAvailable).toBe('5.1.0');
            expect(updateManager.notify).toHaveBeenCalled();
        });

        it('should notify user on update-downloaded', () => {
            let cb: any;
            autoUpdater.on.mockImplementation((event, callback) => {
                if (event === 'update-downloaded') {
                    cb = callback;
                }
                return autoUpdater;
            });

            const updateManager = new UpdateManager();
            updateManager.notifyDownloaded = jest.fn();
            cb({version: '5.1.0'});

            expect(updateManager.versionDownloaded).toBe('5.1.0');
            expect(updateManager.notifyDownloaded).toHaveBeenCalled();
        });

        it('should check for updates when emitted', () => {
            let cb: any;
            ipcMain.on.mockImplementation((event, callback) => {
                if (event === CHECK_FOR_UPDATES) {
                    cb = callback;
                }
                return ipcMain;
            });

            const updateManager = new UpdateManager();
            updateManager.checkForUpdates = jest.fn();
            cb();

            expect(updateManager.checkForUpdates).toHaveBeenCalledWith(true);
        });
    });

    describe('notify', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.runAllTimers();
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });

        it('should add a new timeout', () => {
            const updateManager = new UpdateManager();
            updateManager.notify();
            updateManager.notify = jest.fn();
            jest.runAllTimers();
            expect(updateManager.notify).toBeCalled();
        });

        it('should display upgrade notification', () => {
            const updateManager = new UpdateManager();
            updateManager.versionAvailable = '5.1.0';
            updateManager.notify();
            updateManager.notify = jest.fn();
            expect(NotificationManager.displayUpgrade).toHaveBeenCalledWith('5.1.0', expect.any(Function));
        });

        it('should display downloaded upgrade notification', () => {
            const updateManager = new UpdateManager();
            updateManager.versionDownloaded = '5.1.0';
            updateManager.notify();
            updateManager.notify = jest.fn();
            expect(NotificationManager.displayRestartToUpgrade).toHaveBeenCalledWith('5.1.0', expect.any(Function));
        });
    });

    describe('checkForUpdates', () => {
        beforeEach(() => {
            autoUpdater.checkForUpdates.mockReturnValue(Promise.resolve(null));
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        afterAll(() => {
            jest.runOnlyPendingTimers();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should show dialog if update is not available', () => {
            autoUpdater.once.mockImplementation((event, callback) => {
                if (event === 'update-not-available') {
                    (callback as any)();
                }
                return autoUpdater;
            });

            const updateManager = new UpdateManager();
            updateManager.displayNoUpgrade = jest.fn();
            updateManager.checkForUpdates(true);
            updateManager.checkForUpdates = jest.fn();
            expect(updateManager.displayNoUpgrade).toHaveBeenCalled();
        });

        it('should check again at the next interval', () => {
            const updateManager = new UpdateManager();
            updateManager.checkForUpdates(false);
            updateManager.checkForUpdates = jest.fn();
            jest.runAllTimers();
            expect(updateManager.checkForUpdates).toBeCalled();
        });
    });
});
