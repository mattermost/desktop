// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';
import path from 'path';

import {app} from 'electron';

import {RELOAD_CONFIGURATION} from 'common/communication';
import Config from 'common/config';
import {getDefaultDownloadLocation} from 'common/config/defaultPreferences';
import {setLoggingLevel} from 'common/log';
import {handleConfigUpdate} from 'main/app/config';
import {handleMainWindowIsShown} from 'main/app/intercom';
import AutoLauncher from 'main/AutoLauncher';
import MainWindow from 'main/windows/mainWindow';

jest.mock('electron', () => ({
    app: {
        getAppPath: () => '/path/to/app',
        isReady: jest.fn(),
        setPath: jest.fn(),
        getPath: jest.fn(() => '/valid/downloads/path'),
    },
    ipcMain: {
        emit: jest.fn(),
        on: jest.fn(),
    },
}));

jest.mock('os', () => ({
    homedir: jest.fn(),
}));

jest.mock('main/app/utils', () => ({
    handleUpdateMenuEvent: jest.fn(),
    updateSpellCheckerLocales: jest.fn(),
    setLoggingLevel: jest.fn(),
}));
jest.mock('main/app/intercom', () => ({
    handleMainWindowIsShown: jest.fn(),
}));
jest.mock('main/AutoLauncher', () => ({
    enable: jest.fn(),
    disable: jest.fn(),
}));
jest.mock('main/badge', () => ({
    setUnreadBadgeSetting: jest.fn(),
}));
jest.mock('main/tray/tray', () => ({
    refreshTrayImages: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({
    reloadConfiguration: jest.fn(),
}));
jest.mock('main/views/loadingScreen', () => ({}));
jest.mock('main/windows/mainWindow', () => ({
    sendToRenderer: jest.fn(),
}));

describe('main/app/config', () => {
    describe('handleConfigUpdate', () => {
        const originalPlatform = process.platform;
        const originalXDGDownloadDir = process.env.XDG_DOWNLOAD_DIR;
        beforeEach(() => {
            AutoLauncher.enable.mockResolvedValue({});
            AutoLauncher.disable.mockResolvedValue({});
        });

        afterEach(() => {
            delete Config.registryConfigData;
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });

            if (originalXDGDownloadDir) {
                process.env.XDG_DOWNLOAD_DIR = originalXDGDownloadDir;
            } else {
                delete process.env.XDG_DOWNLOAD_DIR;
            }
            // eslint-disable-next-line no-underscore-dangle
            global.__IS_MAC_APP_STORE__ = false;
        });

        it('should reload renderer config only when app is ready', () => {
            handleConfigUpdate({});
            expect(MainWindow.sendToRenderer).not.toBeCalled();

            app.isReady.mockReturnValue(true);
            handleConfigUpdate({});
            expect(MainWindow.sendToRenderer).toBeCalledWith(RELOAD_CONFIGURATION);
        });

        it('should set download path if applicable', () => {
            handleConfigUpdate({downloadLocation: '/a/download/location'});
            expect(app.setPath).toHaveBeenCalledWith('downloads', '/a/download/location');
        });

        it('should return undefined for Mac App Store builds', () => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // eslint-disable-next-line no-underscore-dangle
            global.__IS_MAC_APP_STORE__ = true;

            expect(getDefaultDownloadLocation()).toBeUndefined();
        });

        it('should return XDG_DOWNLOAD_DIR if running on Linux and environment variable is set', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });

            process.env.XDG_DOWNLOAD_DIR = '/home/user/xdg-downloads';
            const result = getDefaultDownloadLocation();
            expect(result).toBe('/home/user/xdg-downloads');
        });

        it('should return app.getPath("downloads") if available', () => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // eslint-disable-next-line no-underscore-dangle
            global.__IS_MAC_APP_STORE__ = false;

            (app.getPath).mockReturnValue('/custom/downloads');

            const result = getDefaultDownloadLocation();

            expect(result).toBe('/custom/downloads');
            expect(app.getPath).toHaveBeenCalledWith('downloads');
        });

        it('should fallback to home directory if app.getPath("downloads") is not available', () => {
            (app.getPath).mockReturnValue(null);

            (os.homedir).mockReturnValue('/home/user');

            const result = getDefaultDownloadLocation();

            expect(result).toBe(path.join('/home/user', 'Downloads'));
            expect(app.getPath).toHaveBeenCalledWith('downloads');
        });

        it('should enable/disable auto launch on windows/linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            handleConfigUpdate({});
            expect(AutoLauncher.disable).toHaveBeenCalled();

            handleConfigUpdate({autostart: true});
            expect(AutoLauncher.enable).toHaveBeenCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should recheck servers after config update if registry data is pulled in', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            Config.registryConfigData = {};

            handleConfigUpdate({servers: []});
            expect(handleMainWindowIsShown).toHaveBeenCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should set logging level correctly', () => {
            handleConfigUpdate({logLevel: 'info'});
            expect(setLoggingLevel).toBeCalledWith('info');
            handleConfigUpdate({logLevel: 'debug'});
            expect(setLoggingLevel).toBeCalledWith('debug');
        });
    });
});
