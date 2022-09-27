// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';
import {BrowserWindow} from 'electron';

import {CALLS_WIDGET_SHARE_SCREEN} from 'common/communication';

import CallsWidgetWindow from './callsWidgetWindow';

jest.mock('electron', () => ({
    BrowserWindow: jest.fn(),
    ipcMain: {
        on: jest.fn(),
        off: jest.fn(),
    },
}));

describe('main/windows/callsWidgetWindow', () => {
    describe('create CallsWidgetWindow', () => {
        const widgetConfig = {
            callID: 'test',
            siteURL: 'http://localhost:8065',
            title: '',
            serverName: 'test',
        };

        const mainWindow = {
            getBounds: jest.fn(),
        };

        const baseWindow = new EventEmitter();
        baseWindow.loadURL = jest.fn();
        baseWindow.focus = jest.fn();
        baseWindow.setVisibleOnAllWorkspaces = jest.fn();
        baseWindow.setAlwaysOnTop = jest.fn();
        baseWindow.setBackgroundColor = jest.fn();
        baseWindow.setMenuBarVisibility = jest.fn();
        baseWindow.setBounds = jest.fn();

        beforeEach(() => {
            mainWindow.getBounds.mockImplementation(() => {
                return {
                    x: 0,
                    y: 0,
                    width: 1280,
                    height: 720,
                };
            });

            baseWindow.getBounds = jest.fn(() => {
                return {
                    x: 0,
                    y: 0,
                    width: 280,
                    height: 86,
                };
            });

            baseWindow.loadURL.mockImplementation(() => ({
                catch: jest.fn(),
            }));
            BrowserWindow.mockImplementation(() => baseWindow);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('verify initial configuration', () => {
            const widgetWindow = new CallsWidgetWindow(mainWindow, widgetConfig);
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                width: widgetWindow.minWidth,
                height: widgetWindow.minHeight,
                minWidth: widgetWindow.minWidth,
                minHeight: widgetWindow.minHeight,
                fullscreen: false,
                resizable: false,
                frame: false,
                transparent: true,
                show: false,
                alwaysOnTop: true,
            }));
        });

        it('showing window', () => {
            baseWindow.show = jest.fn(() => {
                baseWindow.emit('show');
            });

            const widgetWindow = new CallsWidgetWindow(mainWindow, widgetConfig);
            widgetWindow.win.emit('ready-to-show');

            expect(widgetWindow.win.show).toHaveBeenCalled();
            expect(widgetWindow.win.setAlwaysOnTop).toHaveBeenCalled();
            expect(widgetWindow.win.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 622,
                width: 280,
                height: 86,
            });
        });

        it('loadURL error', () => {
            baseWindow.show = jest.fn(() => {
                baseWindow.emit('show');
            });

            baseWindow.loadURL = jest.fn(() => {
                return Promise.reject(new Error('failed to load URL'));
            });

            const widgetWindow = new CallsWidgetWindow(mainWindow, widgetConfig);
            expect(widgetWindow.win.loadURL).toHaveBeenCalled();
        });

        it('open devTools', () => {
            process.env.MM_DEBUG_CALLS_WIDGET = 'true';

            baseWindow.show = jest.fn(() => {
                baseWindow.emit('show');
            });

            baseWindow.webContents = {
                openDevTools: jest.fn(),
            };

            const widgetWindow = new CallsWidgetWindow(mainWindow, widgetConfig);
            widgetWindow.win.emit('ready-to-show');

            expect(widgetWindow.win.webContents.openDevTools).toHaveBeenCalled();
        });

        it('closing window', () => {
            baseWindow.close = jest.fn(() => {
                baseWindow.emit('closed');
            });

            const widgetWindow = new CallsWidgetWindow(mainWindow, widgetConfig);
            widgetWindow.close();
            expect(widgetWindow.win.close).toHaveBeenCalled();
        });

        it('resize', () => {
            baseWindow.show = jest.fn(() => {
                baseWindow.emit('show');
            });

            let winBounds = {
                x: 0,
                y: 0,
                width: 280,
                height: 86,
            };
            baseWindow.getBounds = jest.fn(() => {
                return winBounds;
            });

            baseWindow.setBounds = jest.fn((bounds) => {
                winBounds = bounds;
            });

            const widgetWindow = new CallsWidgetWindow(mainWindow, widgetConfig);
            widgetWindow.win.emit('ready-to-show');

            expect(baseWindow.setBounds).toHaveBeenCalledTimes(2);

            widgetWindow.onResize(null, {
                element: 'calls-widget-menu',
                height: 100,
            });

            expect(baseWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 522,
                width: 280,
                height: 186,
            });

            widgetWindow.onResize(null, {
                element: 'calls-widget-audio-menu',
                width: 100,
            });

            expect(baseWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 522,
                width: 380,
                height: 186,
            });

            widgetWindow.onResize(null, {
                element: 'calls-widget-audio-menu',
                width: 0,
            });

            expect(baseWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 522,
                width: 280,
                height: 186,
            });

            widgetWindow.onResize(null, {
                element: 'calls-widget-menu',
                height: 0,
            });

            expect(baseWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 622,
                width: 280,
                height: 86,
            });
        });

        it('getServerName', () => {
            const widgetWindow = new CallsWidgetWindow(mainWindow, widgetConfig);
            expect(widgetWindow.getServerName()).toBe('test');
        });

        it('onShareScreen', () => {
            baseWindow.webContents = {
                send: jest.fn(),
            };

            const widgetWindow = new CallsWidgetWindow(mainWindow, widgetConfig);
            const message = {
                sourceID: 'test',
                withAudio: false,
            };
            widgetWindow.onShareScreen(null, '', message);
            expect(widgetWindow.win.webContents.send).toHaveBeenCalledWith(CALLS_WIDGET_SHARE_SCREEN, message);
        });
    });
});
