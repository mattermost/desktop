// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

import {RELOAD_CONFIGURATION} from 'common/communication';
import Config from 'common/config';
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
    },
    ipcMain: {
        emit: jest.fn(),
        on: jest.fn(),
    },
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
        beforeEach(() => {
            AutoLauncher.enable.mockResolvedValue({});
            AutoLauncher.disable.mockResolvedValue({});
        });

        afterEach(() => {
            delete Config.registryConfigData;
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
