// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';
import {BrowserWindow} from 'electron';

import {CALLS_WIDGET_SHARE_SCREEN, CALLS_JOINED_CALL} from 'common/communication';
import {
    MINIMUM_CALLS_WIDGET_WIDTH,
    MINIMUM_CALLS_WIDGET_HEIGHT,
    CALLS_PLUGIN_ID,
} from 'common/utils/constants';
import WebContentsEventManager from '../views/webContentEvents';

import CallsWidgetWindow from './callsWidgetWindow';

jest.mock('electron', () => ({
    app: {
        getAppPath: () => '/path/to/app',
    },
    BrowserWindow: jest.fn(),
    ipcMain: {
        on: jest.fn(),
        off: jest.fn(),
        handle: jest.fn(),
    },
}));

jest.mock('../views/webContentEvents', () => ({
    generateNewWindowListener: jest.fn(),
}));

describe('main/windows/callsWidgetWindow', () => {
    describe('create CallsWidgetWindow', () => {
        const widgetConfig = {
            callID: 'test-call-id',
            siteURL: 'http://localhost:8065',
            title: '',
            serverName: 'test-server-name',
            channelURL: '/team/channel_id',
        };

        const mainWindow = {
            getBounds: jest.fn(),
        };

        const mainView = {
            view: {
                webContents: {
                    send: jest.fn(),
                },
            },
        };

        const baseWindow = new EventEmitter();
        baseWindow.loadURL = jest.fn();
        baseWindow.focus = jest.fn();
        baseWindow.setVisibleOnAllWorkspaces = jest.fn();
        baseWindow.setAlwaysOnTop = jest.fn();
        baseWindow.setBackgroundColor = jest.fn();
        baseWindow.setMenuBarVisibility = jest.fn();
        baseWindow.setBounds = jest.fn();
        baseWindow.webContents = {
            setWindowOpenHandler: jest.fn(),
            on: jest.fn(),
        };

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
                    width: MINIMUM_CALLS_WIDGET_WIDTH,
                    height: MINIMUM_CALLS_WIDGET_HEIGHT,
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
            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            expect(widgetWindow).toBeDefined();
            expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                width: MINIMUM_CALLS_WIDGET_WIDTH,
                height: MINIMUM_CALLS_WIDGET_HEIGHT,
                fullscreen: false,
                resizable: false,
                frame: false,
                transparent: true,
                show: false,
                alwaysOnTop: true,
                backgroundColor: '#00ffffff',
            }));
        });

        it('showing window', () => {
            baseWindow.show = jest.fn(() => {
                baseWindow.emit('show');
            });

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            widgetWindow.win.emit('ready-to-show');

            expect(widgetWindow.win.show).toHaveBeenCalled();
            expect(widgetWindow.win.setAlwaysOnTop).toHaveBeenCalled();
            expect(widgetWindow.win.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 618,
                width: MINIMUM_CALLS_WIDGET_WIDTH,
                height: MINIMUM_CALLS_WIDGET_HEIGHT,
            });
        });

        it('loadURL error', () => {
            baseWindow.show = jest.fn(() => {
                baseWindow.emit('show');
            });

            baseWindow.loadURL = jest.fn(() => {
                return Promise.reject(new Error('failed to load URL'));
            });

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            expect(widgetWindow.win.loadURL).toHaveBeenCalled();
        });

        it('open devTools', () => {
            process.env.MM_DEBUG_CALLS_WIDGET = 'true';

            baseWindow.show = jest.fn(() => {
                baseWindow.emit('show');
            });

            baseWindow.webContents = {
                ...baseWindow.webContents,
                openDevTools: jest.fn(),
            };

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            widgetWindow.win.emit('ready-to-show');

            expect(widgetWindow.win.webContents.openDevTools).toHaveBeenCalled();
        });

        it('closing window', () => {
            baseWindow.close = jest.fn(() => {
                baseWindow.emit('closed');
            });

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
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
                width: MINIMUM_CALLS_WIDGET_WIDTH,
                height: MINIMUM_CALLS_WIDGET_HEIGHT,
            };
            baseWindow.getBounds = jest.fn(() => {
                return winBounds;
            });

            baseWindow.setBounds = jest.fn((bounds) => {
                winBounds = bounds;
            });

            baseWindow.webContents.getZoomFactor = jest.fn(() => 1.0);

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            widgetWindow.win.emit('ready-to-show');

            expect(baseWindow.setBounds).toHaveBeenCalledTimes(2);

            expect(baseWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 720 - MINIMUM_CALLS_WIDGET_HEIGHT - 12,
                width: MINIMUM_CALLS_WIDGET_WIDTH,
                height: MINIMUM_CALLS_WIDGET_HEIGHT,
            });

            widgetWindow.onResize(null, {
                element: 'calls-widget',
                width: 300,
                height: 100,
            });

            expect(baseWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 720 - 100 - 12,
                width: 300,
                height: 100,
            });
        });

        it('zoom', () => {
            baseWindow.show = jest.fn(() => {
                baseWindow.emit('show');
            });

            let winBounds = {
                x: 0,
                y: 0,
                width: MINIMUM_CALLS_WIDGET_WIDTH,
                height: MINIMUM_CALLS_WIDGET_HEIGHT,
            };
            baseWindow.getBounds = jest.fn(() => {
                return winBounds;
            });

            baseWindow.setBounds = jest.fn((bounds) => {
                winBounds = bounds;
            });

            baseWindow.webContents.getZoomFactor = jest.fn(() => 1.0);

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            widgetWindow.win.emit('ready-to-show');

            expect(baseWindow.setBounds).toHaveBeenCalledTimes(1);
            expect(baseWindow.webContents.getZoomFactor).toHaveBeenCalledTimes(0);

            baseWindow.webContents.getZoomFactor = jest.fn(() => 2.0);
            widgetWindow.onResize(null, {
                element: 'calls-widget',
                width: 300,
                height: 100,
            });
            expect(baseWindow.webContents.getZoomFactor).toHaveBeenCalledTimes(1);
            expect(baseWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 720 - 200 - 12,
                width: 600,
                height: 200,
            });

            baseWindow.webContents.getZoomFactor = jest.fn(() => 0.5);
            widgetWindow.onResize(null, {
                element: 'calls-widget',
                width: 300,
                height: 100,
            });
            expect(baseWindow.webContents.getZoomFactor).toHaveBeenCalledTimes(1);
            expect(baseWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 720 - 50 - 12,
                width: 150,
                height: 50,
            });
        });

        it('getServerName', () => {
            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            expect(widgetWindow.getServerName()).toBe('test-server-name');
        });

        it('getChannelURL', () => {
            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            expect(widgetWindow.getChannelURL()).toBe('/team/channel_id');
        });

        it('getChannelURL', () => {
            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            expect(widgetWindow.getCallID()).toBe('test-call-id');
        });

        it('getWidgetURL', () => {
            const config = {
                ...widgetConfig,
                siteURL: 'http://localhost:8065/subpath',
                title: 'call test title #/&',
            };
            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, config);
            const expected = `${config.siteURL}/plugins/${CALLS_PLUGIN_ID}/standalone/widget.html?call_id=${config.callID}&title=call+test+title+%23%2F%26`;
            expect(widgetWindow.getWidgetURL()).toBe(expected);
        });

        it('onShareScreen', () => {
            baseWindow.webContents = {
                ...baseWindow.webContents,
                send: jest.fn(),
            };

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            const message = {
                sourceID: 'test-source-id',
                withAudio: false,
            };
            widgetWindow.onShareScreen(null, '', message);
            expect(widgetWindow.win.webContents.send).toHaveBeenCalledWith(CALLS_WIDGET_SHARE_SCREEN, message);
        });

        it('onJoinedCall', () => {
            baseWindow.webContents = {
                ...baseWindow.webContents,
                send: jest.fn(),
            };

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            const message = {
                callID: 'test-call-id',
            };
            widgetWindow.onJoinedCall(null, message);
            expect(widgetWindow.mainView.view.webContents.send).toHaveBeenCalledWith(CALLS_JOINED_CALL, message);
        });

        it('menubar disabled on popout', () => {
            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            expect(widgetWindow.onPopOutOpen()).toHaveProperty('action', 'allow');
            expect(widgetWindow.onPopOutOpen().overrideBrowserWindowOptions).toHaveProperty('autoHideMenuBar', true);
        });

        it('onPopOutFocus', () => {
            baseWindow.webContents = {
                ...baseWindow.webContents,
                send: jest.fn(),
            };

            baseWindow.restore = jest.fn();

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);

            expect(baseWindow.webContents.setWindowOpenHandler).toHaveBeenCalledWith(widgetWindow.onPopOutOpen);
            expect(baseWindow.webContents.on).toHaveBeenCalledWith('did-create-window', widgetWindow.onPopOutCreate);

            expect(widgetWindow.popOut).toBeNull();

            const popOut = new EventEmitter();
            popOut.webContents = {
                setWindowOpenHandler: jest.fn(),
                on: jest.fn(),
                id: 'webContentsId',
            };
            popOut.focus = jest.fn();
            popOut.restore = jest.fn();
            popOut.isMinimized = jest.fn().mockReturnValue(false);

            widgetWindow.onPopOutFocus();
            expect(popOut.focus).not.toHaveBeenCalled();
            expect(popOut.restore).not.toHaveBeenCalled();

            widgetWindow.onPopOutCreate(popOut);
            expect(widgetWindow.popOut).toBe(popOut);
            expect(popOut.webContents.setWindowOpenHandler).toHaveBeenCalled();
            expect(WebContentsEventManager.generateNewWindowListener).toHaveBeenCalledWith('webContentsId', true);

            widgetWindow.onPopOutFocus();
            expect(popOut.focus).toHaveBeenCalled();
            expect(popOut.restore).not.toHaveBeenCalled();

            popOut.isMinimized = jest.fn().mockReturnValue(true);
            widgetWindow.onPopOutFocus();
            expect(popOut.focus).toHaveBeenCalled();
            expect(popOut.restore).toHaveBeenCalled();
        });

        it('getWebContentsId', () => {
            baseWindow.webContents = {
                ...baseWindow.webContents,
                id: 'testID',
            };

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            expect(widgetWindow.getWebContentsId()).toBe('testID');
        });

        it('getURL', () => {
            baseWindow.webContents = {
                ...baseWindow.webContents,
                id: 'testID',
                getURL: jest.fn(() => 'http://localhost:8065/'),
            };

            const widgetWindow = new CallsWidgetWindow(mainWindow, mainView, widgetConfig);
            expect(widgetWindow.getURL().toString()).toBe('http://localhost:8065/');
        });
    });
});
