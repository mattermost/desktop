// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Config from 'common/config';
import {handleConfigUpdate} from 'main/app/config';
import AutoLauncher from 'main/AutoLauncher';

import Tray from './tray';

jest.mock('path', () => ({
    join: (a, b) => b,
    resolve: (a, b, c) => (c || b),
}));
jest.mock('electron', () => {
    class NativeImageMock {
        image;

        constructor(path) {
            this.image = path;
            return this;
        }

        static createFromPath(path) {
            return new NativeImageMock(path);
        }

        setTemplateImage = () => jest.fn();
    }
    return {
        app: {
            getAppPath: () => '/path/to/app',
            isReady: jest.fn(),
            setPath: jest.fn(),
            getPath: jest.fn(() => '/valid/downloads/path'),
        },
        ipcMain: {
            emit: jest.fn(),
            handle: jest.fn(),
            on: jest.fn(),
        },
        nativeImage: NativeImageMock,
        nativeTheme: {
            shouldUseDarkColors: true, // the value doesn't matter
        },
    };
});
jest.mock('main/app/utils', () => ({
    handleUpdateMenuEvent: jest.fn(),
    updateSpellCheckerLocales: jest.fn(),
    setLoggingLevel: jest.fn(),
    updateServerInfos: jest.fn(),
}));
jest.mock('main/app/intercom', () => ({
    handleMainWindowIsShown: jest.fn(),
}));
jest.mock('main/AutoLauncher', () => ({
    enable: jest.fn(),
    disable: jest.fn(),
}));
jest.mock('app/system/badge', () => ({
    setUnreadBadgeSetting: jest.fn(),
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    sendToRenderer: jest.fn(),
    on: jest.fn(),
}));
jest.mock('app/mainWindow/modals/modalManager', () => ({
    isModalDisplayed: jest.fn(),
}));
jest.mock('common/config', () => {
    const mockConfig = {
        getWindowsSystemDarkMode: jest.fn(),
    };
    return {
        __esModule: true,
        default: mockConfig,
    };
});

describe('main/tray', () => {
    beforeEach(() => {
        AutoLauncher.enable.mockResolvedValue({});
        AutoLauncher.disable.mockResolvedValue({});
    });
    describe('config changes', () => {
        let spy;
        beforeAll(() => {
            spy = jest.spyOn(Tray, 'refreshImages').mockImplementation();
        });
        afterAll(() => {
            spy.mockRestore();
        });
        it('should update the tray icon color immediately when the config is updated', () => {
            handleConfigUpdate({
                trayIconTheme: 'light',
            });
            expect(Tray.refreshImages).toHaveBeenCalledWith('light');
        });
        it('should update the tray icon color immediately when the config is updated', () => {
            handleConfigUpdate({
                trayIconTheme: 'dark',
            });
            expect(Tray.refreshImages).toHaveBeenCalledWith('dark');
        });
    });

    describe('darwin', () => {
        const darwinResultAllThemes = {
            normal: 'osx/menuIcons/MenuIcon16Template.png',
            unread: 'osx/menuIcons/MenuIconUnread16Template.png',
            mention: 'osx/menuIcons/MenuIconUnread16Template.png',
        };
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'darwin',
        });
        const result = Tray.refreshImages('light');
        it.each(Object.keys(result))('match "%s"', (a) => {
            expect(result[a].image).toBe(darwinResultAllThemes[a]);
        });
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });

    describe('win32 - light', () => {
        const theme = 'light';
        const winResultLight = {
            normal: `windows/tray_${theme}.ico`,
            unread: `windows/tray_${theme}_unread.ico`,
            mention: `windows/tray_${theme}_mention.ico`,
        };
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });
        const result = Tray.refreshImages('light');
        it.each(Object.keys(result))('match "%s"', (a) => {
            expect(result[a].image).toBe(winResultLight[a]);
        });
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });

    describe('win32 - dark', () => {
        const theme = 'dark';
        const winResultDark = {
            normal: `windows/tray_${theme}.ico`,
            unread: `windows/tray_${theme}_unread.ico`,
            mention: `windows/tray_${theme}_mention.ico`,
        };
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });
        const result = Tray.refreshImages('dark');
        it.each(Object.keys(result))('match "%s"', (a) => {
            expect(result[a].image).toBe(winResultDark[a]);
        });
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });

    describe('linux - light', () => {
        const theme = 'light';
        const linuxResultLight = {
            normal: `top_bar_${theme}_16.png`,
            unread: `top_bar_${theme}_unread_16.png`,
            mention: `top_bar_${theme}_mention_16.png`,
        };
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'linux',
        });
        const result = Tray.refreshImages('light');
        it.each(Object.keys(result))('match "%s"', (a) => {
            expect(result[a].image).toBe(linuxResultLight[a]);
        });
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });

    describe('linux - dark', () => {
        const theme = 'dark';
        const linuxResultDark = {
            normal: `top_bar_${theme}_16.png`,
            unread: `top_bar_${theme}_unread_16.png`,
            mention: `top_bar_${theme}_mention_16.png`,
        };
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'linux',
        });
        const result = Tray.refreshImages('dark');
        it.each(Object.keys(result))('match "%s"', (a) => {
            expect(result[a].image).toBe(linuxResultDark[a]);
        });
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });

    describe('win32 - use_system', () => {
        const originalPlatform = process.platform;

        beforeEach(() => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            jest.clearAllMocks();
        });

        afterEach(() => {
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should use dark theme when system is in light mode (AppsUseLightTheme = true)', () => {
            Config.getWindowsSystemDarkMode.mockReturnValue(false);
            const theme = 'dark';
            const winResultDark = {
                normal: `windows/tray_${theme}.ico`,
                unread: `windows/tray_${theme}_unread.ico`,
                mention: `windows/tray_${theme}_mention.ico`,
            };

            const result = Tray.refreshImages('use_system');

            expect(Config.getWindowsSystemDarkMode).toHaveBeenCalled();
            expect(result.normal.image).toBe(winResultDark.normal);
            expect(result.unread.image).toBe(winResultDark.unread);
            expect(result.mention.image).toBe(winResultDark.mention);
        });

        it('should use light theme when system is in dark mode (AppsUseLightTheme = false)', () => {
            Config.getWindowsSystemDarkMode.mockReturnValue(true);
            const theme = 'light';
            const winResultLight = {
                normal: `windows/tray_${theme}.ico`,
                unread: `windows/tray_${theme}_unread.ico`,
                mention: `windows/tray_${theme}_mention.ico`,
            };

            const result = Tray.refreshImages('use_system');

            expect(Config.getWindowsSystemDarkMode).toHaveBeenCalled();
            expect(result.normal.image).toBe(winResultLight.normal);
            expect(result.unread.image).toBe(winResultLight.unread);
            expect(result.mention.image).toBe(winResultLight.mention);
        });

        it('should call getWindowsSystemDarkMode when trayIconTheme is use_system', () => {
            Config.getWindowsSystemDarkMode.mockReturnValue(false);

            Tray.refreshImages('use_system');

            expect(Config.getWindowsSystemDarkMode).toHaveBeenCalledTimes(1);
        });

        it('should not call getWindowsSystemDarkMode when trayIconTheme is not use_system', () => {
            Config.getWindowsSystemDarkMode.mockReturnValue(false);

            Tray.refreshImages('light');
            Tray.refreshImages('dark');

            expect(Config.getWindowsSystemDarkMode).not.toHaveBeenCalled();
        });
    });
});
