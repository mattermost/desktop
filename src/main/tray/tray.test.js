// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
jest.mock('main/badge', () => ({
    setUnreadBadgeSetting: jest.fn(),
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    sendToRenderer: jest.fn(),
    on: jest.fn(),
}));

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
});
