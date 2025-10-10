// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcMain} from 'electron';

import {
    DARK_MODE_CHANGE,
    RESET_THEME,
    UPDATE_THEME,
} from 'common/communication';
import ServerManager from 'common/servers/serverManager';

import {ThemeManager} from './themeManager';

jest.mock('electron', () => {
    const EventEmitter = jest.requireActual('events');
    const mockIpcMain = new EventEmitter();
    mockIpcMain.handle = jest.fn((event, handler) => mockIpcMain.on(event, handler));

    return {
        ipcMain: mockIpcMain,
        mockIpcMain,
        nativeTheme: {
            themeSource: 'light',
        },
    };
});

jest.mock('common/config', () => ({
    themeSyncing: true,
}));

jest.mock('main/utils', () => ({
    isLightColor: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => {
    const EventEmitter = jest.requireActual('events');
    const mockServerManager = new EventEmitter();

    return {
        on: jest.fn((event, handler) => mockServerManager.on(event, handler)),
        emit: jest.fn((event, ...args) => mockServerManager.emit(event, ...args)),
        getCurrentServerId: jest.fn(),
        getServer: jest.fn(),
        getAllServers: jest.fn(),
        mockServerManager,
    };
});

describe('ThemeManager', () => {
    let themeManager;
    let mockWebContents;
    let mockWebContents2;

    beforeEach(() => {
        jest.clearAllMocks();

        const {EventEmitter} = jest.requireActual('events');

        mockWebContents = new EventEmitter();
        mockWebContents.send = jest.fn();
        mockWebContents.id = 1;

        mockWebContents2 = new EventEmitter();
        mockWebContents2.send = jest.fn();
        mockWebContents2.id = 2;

        // Mock getAllServers to return empty array by default
        ServerManager.getAllServers.mockReturnValue([]);

        themeManager = new ThemeManager();
    });

    afterEach(() => {
        // Clean up event listeners to avoid memory leaks
        ipcMain.removeAllListeners();
        ServerManager.mockServerManager.removeAllListeners();
        jest.resetAllMocks();
    });

    describe('registerMainWindowView', () => {
        it('should add webContents to mainWindowViews', () => {
            themeManager.registerMainWindowView(mockWebContents);

            expect(themeManager.mainWindowViews.has(mockWebContents)).toBe(true);
        });

        it('should remove webContents from mainWindowViews when destroyed', () => {
            themeManager.registerMainWindowView(mockWebContents);

            // Emit the destroyed event
            mockWebContents.emit('destroyed');

            expect(themeManager.mainWindowViews.has(mockWebContents)).toBe(false);
        });
    });

    describe('registerPopoutView', () => {
        it('should add webContents to popoutViews for serverId', () => {
            const serverId = 'test-server-id';
            themeManager.registerPopoutView(mockWebContents, serverId);

            expect(themeManager.popoutViews.has(serverId)).toBe(true);
            expect(themeManager.popoutViews.get(serverId).has(mockWebContents)).toBe(true);
        });

        it('should remove webContents from popoutViews when destroyed', () => {
            const serverId = 'test-server-id';
            themeManager.registerPopoutView(mockWebContents, serverId);

            // Emit the destroyed event
            mockWebContents.emit('destroyed');

            expect(themeManager.popoutViews.get(serverId).has(mockWebContents)).toBe(false);
        });
    });

    describe('handleEmitConfiguration', () => {
        it('should send DARK_MODE_CHANGE to all main window views', () => {
            themeManager.registerMainWindowView(mockWebContents);
            themeManager.registerMainWindowView(mockWebContents2);

            const config = {darkMode: true};
            themeManager.handleEmitConfiguration({}, config);

            expect(mockWebContents.send).toHaveBeenCalledWith(DARK_MODE_CHANGE, true);
            expect(mockWebContents2.send).toHaveBeenCalledWith(DARK_MODE_CHANGE, true);
        });

        it('should send DARK_MODE_CHANGE to all popout views', () => {
            const serverId = 'test-server-id';
            themeManager.registerPopoutView(mockWebContents, serverId);
            themeManager.registerPopoutView(mockWebContents2, serverId);

            const config = {darkMode: false};
            themeManager.handleEmitConfiguration({}, config);

            expect(mockWebContents.send).toHaveBeenCalledWith(DARK_MODE_CHANGE, false);
            expect(mockWebContents2.send).toHaveBeenCalledWith(DARK_MODE_CHANGE, false);
        });

        it('should sync all servers when themeSyncing is enabled', () => {
            const mockServers = [
                {id: 'server-1', theme: {primary: '#111111'}},
                {id: 'server-2', theme: {primary: '#222222'}},
            ];
            ServerManager.getAllServers.mockReturnValue(mockServers);
            const handleServerThemeChangedSpy = jest.spyOn(themeManager, 'handleServerThemeChanged');

            const config = {darkMode: true};
            themeManager.handleEmitConfiguration({}, config);

            expect(handleServerThemeChangedSpy).toHaveBeenCalledWith('server-1');
            expect(handleServerThemeChangedSpy).toHaveBeenCalledWith('server-2');
        });

        it('should reset all themes when themeSyncing is disabled', () => {
            // Mock Config.themeSyncing to be false
            const Config = require('common/config');
            const originalThemeSyncing = Config.themeSyncing;
            Config.themeSyncing = false;

            try {
                themeManager.registerMainWindowView(mockWebContents);
                themeManager.registerPopoutView(mockWebContents2, 'test-server-id');

                const config = {darkMode: true};
                themeManager.handleEmitConfiguration({}, config);

                expect(mockWebContents.send).toHaveBeenCalledWith(RESET_THEME);
                expect(mockWebContents2.send).toHaveBeenCalledWith(RESET_THEME);
            } finally {
                // Restore original value
                Config.themeSyncing = originalThemeSyncing;
            }
        });

        it('should still send dark mode changes when themeSyncing is disabled', () => {
            // Mock Config.themeSyncing to be false
            const Config = require('common/config');
            const originalThemeSyncing = Config.themeSyncing;
            Config.themeSyncing = false;

            try {
                themeManager.registerMainWindowView(mockWebContents);
                themeManager.registerPopoutView(mockWebContents2, 'test-server-id');

                const config = {darkMode: false};
                themeManager.handleEmitConfiguration({}, config);

                expect(mockWebContents.send).toHaveBeenCalledWith(DARK_MODE_CHANGE, false);
                expect(mockWebContents2.send).toHaveBeenCalledWith(DARK_MODE_CHANGE, false);
            } finally {
                // Restore original value
                Config.themeSyncing = originalThemeSyncing;
            }
        });
    });

    describe('handleServerThemeChanged', () => {
        beforeEach(() => {
            themeManager.registerMainWindowView(mockWebContents);
            themeManager.registerPopoutView(mockWebContents2, 'test-server-id');
        });

        it('should update main views when server theme changes', () => {
            const updateMainViewsSpy = jest.spyOn(themeManager, 'updateMainViews');

            themeManager.handleServerThemeChanged('test-server-id');

            expect(updateMainViewsSpy).toHaveBeenCalled();
        });

        it('should send UPDATE_THEME to popout views when server has theme', () => {
            const mockServer = {theme: {primary: '#123456'}};
            ServerManager.getServer.mockReturnValue(mockServer);

            themeManager.handleServerThemeChanged('test-server-id');

            expect(mockWebContents2.send).toHaveBeenCalledWith(UPDATE_THEME, mockServer.theme);
        });

        it('should send RESET_THEME to popout views when server has no theme', () => {
            ServerManager.getServer.mockReturnValue({theme: null});

            themeManager.handleServerThemeChanged('test-server-id');

            expect(mockWebContents2.send).toHaveBeenCalledWith(RESET_THEME);
        });

        it('should send RESET_THEME to popout views when server does not exist', () => {
            ServerManager.getServer.mockReturnValue(null);

            themeManager.handleServerThemeChanged('test-server-id');

            expect(mockWebContents2.send).toHaveBeenCalledWith(RESET_THEME);
        });

        it('should not send to popout views for different server', () => {
            const mockServer = {theme: {primary: '#123456'}};
            ServerManager.getServer.mockReturnValue(mockServer);

            themeManager.handleServerThemeChanged('different-server-id');

            expect(mockWebContents2.send).not.toHaveBeenCalled();
        });
    });

    describe('updateMainViews', () => {
        beforeEach(() => {
            themeManager.registerMainWindowView(mockWebContents);
            themeManager.registerMainWindowView(mockWebContents2);
        });

        it('should send RESET_THEME when no current server', () => {
            ServerManager.getCurrentServerId.mockReturnValue(null);

            themeManager.updateMainViews();

            expect(mockWebContents.send).toHaveBeenCalledWith(RESET_THEME);
            expect(mockWebContents2.send).toHaveBeenCalledWith(RESET_THEME);
        });

        it('should send RESET_THEME when server has no theme', () => {
            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');
            ServerManager.getServer.mockReturnValue({theme: null});

            themeManager.updateMainViews();

            expect(mockWebContents.send).toHaveBeenCalledWith(RESET_THEME);
            expect(mockWebContents2.send).toHaveBeenCalledWith(RESET_THEME);
        });

        it('should send RESET_THEME when server does not exist', () => {
            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');
            ServerManager.getServer.mockReturnValue(null);

            themeManager.updateMainViews();

            expect(mockWebContents.send).toHaveBeenCalledWith(RESET_THEME);
            expect(mockWebContents2.send).toHaveBeenCalledWith(RESET_THEME);
        });

        it('should send UPDATE_THEME when server has theme', () => {
            const mockTheme = {primary: '#123456'};
            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');
            ServerManager.getServer.mockReturnValue({theme: mockTheme});

            themeManager.updateMainViews();

            expect(mockWebContents.send).toHaveBeenCalledWith(UPDATE_THEME, mockTheme);
            expect(mockWebContents2.send).toHaveBeenCalledWith(UPDATE_THEME, mockTheme);
        });
    });

    describe('handleGetTheme', () => {
        it('should return theme for popout view', () => {
            const serverId = 'test-server-id';
            const mockTheme = {primary: '#123456'};
            const mockServer = {theme: mockTheme};

            themeManager.registerPopoutView(mockWebContents, serverId);
            ServerManager.getServer.mockReturnValue(mockServer);

            const event = {sender: mockWebContents};
            const result = themeManager.handleGetTheme(event);

            expect(result).toBe(mockTheme);
        });

        it('should return undefined for popout view when server does not exist', () => {
            const serverId = 'test-server-id';

            themeManager.registerPopoutView(mockWebContents, serverId);
            ServerManager.getServer.mockReturnValue(null);

            const event = {sender: mockWebContents};
            const result = themeManager.handleGetTheme(event);

            expect(result).toBeUndefined();
        });

        it('should return theme for main window view', () => {
            const mockTheme = {primary: '#123456'};
            const mockServer = {theme: mockTheme};

            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');
            ServerManager.getServer.mockReturnValue(mockServer);

            const event = {sender: mockWebContents};
            const result = themeManager.handleGetTheme(event);

            expect(result).toBe(mockTheme);
        });

        it('should return undefined for main window when no current server', () => {
            ServerManager.getCurrentServerId.mockReturnValue(null);

            const event = {sender: mockWebContents};
            const result = themeManager.handleGetTheme(event);

            expect(result).toBeUndefined();
        });

        it('should return undefined for main window when server does not exist', () => {
            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');
            ServerManager.getServer.mockReturnValue(null);

            const event = {sender: mockWebContents};
            const result = themeManager.handleGetTheme(event);

            expect(result).toBeUndefined();
        });
    });
});
