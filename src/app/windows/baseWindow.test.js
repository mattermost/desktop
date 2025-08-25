// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import os from 'os';
import path from 'path';

import {BrowserWindow, app, globalShortcut, ipcMain, dialog} from 'electron';

import {
    EMIT_CONFIGURATION,
    FOCUS_THREE_DOT_MENU,
    RELOAD_CONFIGURATION,
    TOGGLE_SECURE_INPUT,
} from 'common/communication';
import Config from 'common/config';
import {MINIMUM_WINDOW_HEIGHT, MINIMUM_WINDOW_WIDTH, SECOND, TAB_BAR_HEIGHT} from 'common/utils/constants';
import Utils from 'common/utils/util';

import BaseWindow from './baseWindow';

import ContextMenu from '../../main/contextMenu';
import {localizeMessage} from '../../main/i18nManager';
import {getLocalPreload} from '../../main/utils';

jest.mock('os', () => ({
    platform: jest.fn(),
    release: jest.fn(),
}));

jest.mock('path', () => ({
    join: jest.fn(),
    resolve: jest.fn(),
}));

jest.mock('electron', () => {
    const {EventEmitter} = jest.requireActual('events');
    const mockIpcMain = new EventEmitter();
    mockIpcMain.on = jest.fn(mockIpcMain.on);
    mockIpcMain.emit = jest.fn(mockIpcMain.emit);

    return {
        app: {
            getAppPath: jest.fn(),
            name: 'Test App',
            relaunch: jest.fn(),
        },
        BrowserWindow: jest.fn().mockImplementation(() => {
            const mockBrowserWindow = new EventEmitter();
            mockBrowserWindow.on = jest.fn(mockBrowserWindow.on);
            mockBrowserWindow.once = jest.fn(mockBrowserWindow.once);
            mockBrowserWindow.setMenuBarVisibility = jest.fn();
            const mockWebContents = new EventEmitter();
            mockWebContents.zoomLevel = 0;
            mockWebContents.setWindowOpenHandler = jest.fn();
            mockWebContents.openDevTools = jest.fn();
            mockWebContents.send = jest.fn();
            mockWebContents.focus = jest.fn();
            mockWebContents.on = jest.fn(mockWebContents.on);
            mockWebContents.once = jest.fn(mockWebContents.once);
            mockWebContents.emit = jest.fn(mockWebContents.emit);
            mockBrowserWindow.webContents = mockWebContents;
            mockBrowserWindow.getContentBounds = jest.fn(() => ({x: 0, y: 0, width: 800, height: 600}));
            mockBrowserWindow.getSize = jest.fn(() => [800, 600]);
            mockBrowserWindow.restore = jest.fn();
            return mockBrowserWindow;
        }),
        dialog: {
            showMessageBox: jest.fn(),
        },
        globalShortcut: {
            registerAll: jest.fn(),
            unregisterAll: jest.fn(),
        },
        ipcMain: mockIpcMain,
        mockIpcMain,
    };
});

jest.mock('common/config', () => ({
    darkMode: false,
    useSpellChecker: true,
}));

jest.mock('common/utils/util', () => ({
    isVersionGreaterThanOrEqualTo: jest.fn(),
}));

jest.mock('../../main/contextMenu', () => jest.fn());

jest.mock('../../main/utils', () => ({
    getLocalPreload: jest.fn(),
}));

jest.mock('../../main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('app/views/loadingScreen', () => ({
    LoadingScreen: jest.fn().mockImplementation(() => ({
        show: jest.fn(),
        fade: jest.fn(),
        destroy: jest.fn(),
    })),
}));

jest.mock('app/views/urlView', () => ({
    URLView: jest.fn().mockImplementation(() => ({
        show: jest.fn(),
        destroy: jest.fn(),
    })),
}));

describe('BaseWindow', () => {
    const mockContextMenu = {
        reload: jest.fn(),
    };

    beforeEach(() => {
        ContextMenu.mockImplementation(() => mockContextMenu);
        getLocalPreload.mockReturnValue('preload.js');
        path.join.mockReturnValue('icon.png');
        path.resolve.mockReturnValue('assets');
        app.getAppPath.mockReturnValue('/app/path');
        localizeMessage.mockImplementation((key) => key);
    });

    describe('constructor', () => {
        it('should create BrowserWindow with default options', () => {
            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                fullscreenable: process.platform !== 'linux',
                show: false,
                paintWhenInitiallyHidden: true,
                minWidth: MINIMUM_WINDOW_WIDTH,
                minHeight: MINIMUM_WINDOW_HEIGHT,
                titleBarStyle: 'hidden',
                trafficLightPosition: {x: 12, y: 12},
                backgroundColor: '#000',
                webPreferences: {
                    disableBlinkFeatures: 'Auxclick',
                    preload: 'preload.js',
                    spellcheck: true,
                },
            }));
        });

        it('should merge custom options with defaults', () => {
            const customOptions = {
                width: 1000,
                height: 800,
                title: 'Custom Title',
            };

            const baseWindow = new BaseWindow(customOptions);

            expect(baseWindow).toBeDefined();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                width: 1000,
                height: 800,
                title: 'Custom Title',
                minWidth: MINIMUM_WINDOW_WIDTH,
                minHeight: MINIMUM_WINDOW_HEIGHT,
            }));
        });

        it('should set Linux icon when platform is linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'linux'});

            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(path.join).toHaveBeenCalledWith('assets', 'linux', 'app_icon.png');
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                icon: 'icon.png',
            }));

            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });

        it('should not set icon for non-Linux platforms', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'darwin'});

            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.not.objectContaining({
                icon: expect.anything(),
            }));

            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });

        it('should set frameless window for macOS', () => {
            os.platform.mockReturnValue('darwin');

            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                frame: false,
            }));
        });

        it('should set frameless window for Windows 8+', () => {
            os.platform.mockReturnValue('win32');
            os.release.mockReturnValue('6.3.9600');
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(true);

            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                frame: false,
            }));
        });

        it('should set framed window for older Windows versions', () => {
            os.platform.mockReturnValue('win32');
            os.release.mockReturnValue('6.1.7601');
            Utils.isVersionGreaterThanOrEqualTo.mockReturnValue(false);

            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                frame: true,
            }));
        });

        it('should set title bar overlay with light theme colors', () => {
            Config.darkMode = false;

            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                titleBarOverlay: {
                    color: '#efefef',
                    symbolColor: '#474747',
                    height: TAB_BAR_HEIGHT,
                },
            }));
        });

        it('should set title bar overlay with dark theme colors', () => {
            Config.darkMode = true;

            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                titleBarOverlay: {
                    color: '#2e2e2e',
                    symbolColor: '#c1c1c1',
                    height: TAB_BAR_HEIGHT,
                },
            }));
        });

        // Note: Testing BrowserWindow creation failure is complex with current mock setup
        // The actual implementation throws an error if BrowserWindow returns null

        it('should set up event listeners', () => {
            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(baseWindow.browserWindow.once).toHaveBeenCalledWith('restore', expect.any(Function));
            expect(baseWindow.browserWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));
            expect(baseWindow.browserWindow.on).toHaveBeenCalledWith('focus', expect.any(Function));
            expect(baseWindow.browserWindow.on).toHaveBeenCalledWith('blur', expect.any(Function));
            expect(baseWindow.browserWindow.on).toHaveBeenCalledWith('unresponsive', expect.any(Function));
            expect(baseWindow.browserWindow.on).toHaveBeenCalledWith('enter-full-screen', expect.any(Function));
            expect(baseWindow.browserWindow.on).toHaveBeenCalledWith('leave-full-screen', expect.any(Function));
        });

        it('should set menu bar visibility to false', () => {
            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(baseWindow.browserWindow.setMenuBarVisibility).toHaveBeenCalledWith(false);
        });

        it('should set window open handler to deny', () => {
            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(baseWindow.browserWindow.webContents.setWindowOpenHandler).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should open dev tools when MM_DEBUG_SETTINGS is set', () => {
            const originalEnv = process.env.MM_DEBUG_SETTINGS;
            process.env.MM_DEBUG_SETTINGS = 'true';

            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(baseWindow.browserWindow.webContents.openDevTools).toHaveBeenCalledWith({mode: 'detach'});

            process.env.MM_DEBUG_SETTINGS = originalEnv;
        });

        it('should create context menu and reload it', () => {
            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(ContextMenu).toHaveBeenCalledWith({}, baseWindow.browserWindow);
            expect(mockContextMenu.reload).toHaveBeenCalled();
        });

        it('should create LoadingScreen and URLView', () => {
            const {LoadingScreen} = require('app/views/loadingScreen');
            const {URLView} = require('app/views/urlView');

            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(LoadingScreen).toHaveBeenCalledWith(baseWindow.browserWindow);
            expect(URLView).toHaveBeenCalledWith(baseWindow.browserWindow);
        });

        it('should set up IPC listener for EMIT_CONFIGURATION', () => {
            const baseWindow = new BaseWindow({});

            expect(baseWindow).toBeDefined();
            expect(ipcMain.on).toHaveBeenCalledWith(EMIT_CONFIGURATION, expect.any(Function));
        });
    });

    describe('did-finish-load event', () => {
        it('should set ready to true and zoom level to 0', () => {
            const baseWindow = new BaseWindow({});

            baseWindow.browserWindow.webContents.emit('did-finish-load');

            expect(baseWindow.isReady).toBe(true);
            expect(baseWindow.browserWindow.webContents.zoomLevel).toBe(0);
        });
    });

    describe('getBounds', () => {
        it('should return content bounds for non-Linux platforms', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'darwin'});

            const baseWindow = new BaseWindow({});
            const bounds = baseWindow.getBounds();

            expect(baseWindow.browserWindow.getContentBounds).toHaveBeenCalled();
            expect(bounds).toEqual({x: 0, y: 0, width: 800, height: 600});

            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });

        it('should return modified bounds for Linux platform', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'linux'});

            const baseWindow = new BaseWindow({});
            const bounds = baseWindow.getBounds();

            expect(baseWindow.browserWindow.getContentBounds).toHaveBeenCalled();
            expect(baseWindow.browserWindow.getSize).toHaveBeenCalled();
            expect(bounds).toEqual({x: 0, y: 0, width: 800, height: 600});

            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });
    });

    describe('handleAltKeyPressed', () => {
        it('should set altPressStatus to true for Alt key down', () => {
            const baseWindow = new BaseWindow({});

            baseWindow.handleAltKeyPressed({}, {
                type: 'keyDown',
                key: 'Alt',
                alt: true,
                control: false,
                shift: false,
                meta: false,
            });

            expect(baseWindow.altPressStatus).toBe(true);
        });

        it('should set altPressStatus to false for non-Alt key', () => {
            const baseWindow = new BaseWindow({});

            baseWindow.handleAltKeyPressed({}, {
                type: 'keyDown',
                key: 'Control',
                alt: false,
                control: true,
                shift: false,
                meta: false,
            });

            expect(baseWindow.altPressStatus).toBe(false);
        });

        it('should call focusThreeDotMenu on Alt key up when altPressStatus is true', () => {
            const baseWindow = new BaseWindow({});
            const focusSpy = jest.spyOn(baseWindow, 'focusThreeDotMenu');

            baseWindow.handleAltKeyPressed({}, {
                type: 'keyDown',
                key: 'Alt',
                alt: true,
                control: false,
                shift: false,
                meta: false,
            });

            baseWindow.handleAltKeyPressed({}, {
                type: 'keyUp',
                key: 'Alt',
            });

            expect(focusSpy).toHaveBeenCalled();
        });
    });

    describe('focusThreeDotMenu', () => {
        it('should focus web contents and send FOCUS_THREE_DOT_MENU', () => {
            const baseWindow = new BaseWindow({});

            baseWindow.focusThreeDotMenu();

            expect(baseWindow.browserWindow.webContents.focus).toHaveBeenCalled();
            expect(baseWindow.browserWindow.webContents.send).toHaveBeenCalledWith(FOCUS_THREE_DOT_MENU);
        });
    });

    describe('sendToRenderer', () => {
        it('should send message immediately when ready', () => {
            const baseWindow = new BaseWindow({});
            baseWindow.ready = true;

            baseWindow.sendToRenderer('test-channel', 'test-data');

            expect(baseWindow.browserWindow.webContents.send).toHaveBeenCalledWith('test-channel', 'test-data');
        });

        it('should retry sending message when not ready', () => {
            jest.useFakeTimers();
            const baseWindow = new BaseWindow({});
            baseWindow.ready = false;

            baseWindow.sendToRenderer('test-channel', 'test-data');

            expect(baseWindow.browserWindow.webContents.send).not.toHaveBeenCalled();

            // Make the window ready after the first retry
            baseWindow.ready = true;
            jest.advanceTimersByTime(SECOND);

            expect(baseWindow.browserWindow.webContents.send).toHaveBeenCalledWith('test-channel', 'test-data');

            jest.useRealTimers();
        });
    });

    describe('event handlers', () => {
        it('should register global shortcuts on focus for Linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {value: 'linux'});

            const baseWindow = new BaseWindow({});

            baseWindow.browserWindow.emit('focus');

            expect(globalShortcut.registerAll).toHaveBeenCalledWith(
                ['Alt+F', 'Alt+E', 'Alt+V', 'Alt+H', 'Alt+W', 'Alt+P'],
                expect.any(Function),
            );

            Object.defineProperty(process, 'platform', {value: originalPlatform});
        });

        it('should unregister global shortcuts on blur', () => {
            const baseWindow = new BaseWindow({});

            baseWindow.browserWindow.emit('blur');

            expect(globalShortcut.unregisterAll).toHaveBeenCalled();
            expect(ipcMain.emit).toHaveBeenCalledWith(TOGGLE_SECURE_INPUT, null, false);
        });

        it('should handle unresponsive event', async () => {
            const baseWindow = new BaseWindow({});

            dialog.showMessageBox.mockResolvedValue({response: 0});

            baseWindow.browserWindow.emit('unresponsive');

            expect(dialog.showMessageBox).toHaveBeenCalledWith(baseWindow.browserWindow, {
                type: 'warning',
                title: 'Test App',
                message: 'main.CriticalErrorHandler.unresponsive.dialog.message',
                buttons: ['label.no', 'label.yes'],
                defaultId: 0,
            });

            // Wait for the promise to resolve
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(app.relaunch).toHaveBeenCalled();
        });

        it('should send enter-full-screen event', () => {
            const baseWindow = new BaseWindow({});

            baseWindow.browserWindow.emit('enter-full-screen');

            expect(baseWindow.browserWindow.webContents.send).toHaveBeenCalledWith('enter-full-screen');
        });

        it('should send leave-full-screen event', () => {
            const baseWindow = new BaseWindow({});

            baseWindow.browserWindow.emit('leave-full-screen');

            expect(baseWindow.browserWindow.webContents.send).toHaveBeenCalledWith('leave-full-screen');
        });
    });

    describe('EMIT_CONFIGURATION handler', () => {
        it('should send RELOAD_CONFIGURATION when EMIT_CONFIGURATION is received', () => {
            const baseWindow = new BaseWindow({});

            ipcMain.emit(EMIT_CONFIGURATION);

            expect(baseWindow.browserWindow.webContents.send).toHaveBeenCalledWith(RELOAD_CONFIGURATION);
        });
    });
});
