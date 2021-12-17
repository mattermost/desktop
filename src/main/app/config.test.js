// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

import {RELOAD_CONFIGURATION} from 'common/communication';
import Config from 'common/config';

import {handleConfigUpdate} from 'main/app/config';
import {addNewServerModalWhenMainWindowIsShown} from 'main/app/intercom';
import WindowManager from 'main/windows/windowManager';
import AutoLauncher from 'main/AutoLauncher';

jest.mock('electron', () => ({
    app: {
        isReady: jest.fn(),
        setPath: jest.fn(),
    },
    ipcMain: {
        emit: jest.fn(),
        on: jest.fn(),
    },
}));
jest.mock('electron-log', () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

jest.mock('main/app/utils', () => ({
    handleUpdateMenuEvent: jest.fn(),
    updateSpellCheckerLocales: jest.fn(),
    updateServerInfos: jest.fn(),
}));
jest.mock('main/app/intercom', () => ({
    addNewServerModalWhenMainWindowIsShown: jest.fn(),
}));
jest.mock('main/AutoLauncher', () => ({
    enable: jest.fn(),
    disable: jest.fn(),
}));
jest.mock('main/badge', () => ({
    setUnreadBadgeSetting: jest.fn(),
}));
jest.mock('main/tray/tray', () => ({}));
jest.mock('main/windows/windowManager', () => ({
    handleUpdateConfig: jest.fn(),
    sendToRenderer: jest.fn(),
    initializeCurrentServerName: jest.fn(),
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
            expect(WindowManager.sendToRenderer).not.toBeCalled();

            app.isReady.mockReturnValue(true);
            handleConfigUpdate({});
            expect(WindowManager.sendToRenderer).toBeCalledWith(RELOAD_CONFIGURATION);
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

        it('should recheck teams after config update if registry data is pulled in', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            Config.registryConfigData = {};

            handleConfigUpdate({teams: []});
            expect(addNewServerModalWhenMainWindowIsShown).toHaveBeenCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });
});
