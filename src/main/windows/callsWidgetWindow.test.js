// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, desktopCapturer, systemPreferences, ipcMain} from 'electron';

import ServerViewState from 'app/serverViewState';
import {
    CALLS_WIDGET_SHARE_SCREEN,
    BROWSER_HISTORY_PUSH,
    UPDATE_SHORTCUT_MENU,
    CALLS_WIDGET_OPEN_THREAD,
    CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL,
} from 'common/communication';
import {
    MINIMUM_CALLS_WIDGET_WIDTH,
    MINIMUM_CALLS_WIDGET_HEIGHT,
    CALLS_PLUGIN_ID,
} from 'common/utils/constants';
import urlUtils from 'common/utils/url';
import PermissionsManager from 'main/permissionsManager';
import {
    resetScreensharePermissionsMacOS,
    openScreensharePermissionsSettingsMacOS,
} from 'main/utils';
import ViewManager from 'main/views/viewManager';
import WebContentsEventManager from 'main/views/webContentEvents';
import MainWindow from 'main/windows/mainWindow';

import {CallsWidgetWindow} from './callsWidgetWindow';

jest.mock('electron', () => ({
    app: {
        getAppPath: () => '/path/to/app',
    },
    BrowserWindow: jest.fn(),
    ipcMain: {
        on: jest.fn(),
        off: jest.fn(),
        handle: jest.fn(),
        emit: jest.fn(),
    },
    desktopCapturer: {
        getSources: jest.fn(),
    },
    systemPreferences: {
        getUserDefault: jest.fn(),
        getMediaAccessStatus: jest.fn(() => 'granted'),
    },
}));

jest.mock('../views/webContentEvents', () => ({
    addWebContentsEventListeners: jest.fn(),
}));

jest.mock('common/utils/url', () => ({
    isCallsPopOutURL: jest.fn(),
    getFormattedPathName: jest.fn(),
    parseURL: jest.fn(),
}));
jest.mock('main/permissionsManager', () => ({
    doPermissionRequest: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
    focus: jest.fn(),
}));
jest.mock('app/serverViewState', () => ({
    switchServer: jest.fn(),
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
    unregisterView: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({
    getView: jest.fn(),
    getViewByWebContentsId: jest.fn(),
    showById: jest.fn(),
}));
jest.mock('../utils', () => ({
    openScreensharePermissionsSettingsMacOS: jest.fn(),
    resetScreensharePermissionsMacOS: jest.fn(),
    getLocalPreload: jest.fn((file) => file),
    composeUserAgent: jest.fn(),
}));

const mockContextMenuReload = jest.fn();
const mockContextMenuDispose = jest.fn();
jest.mock('../contextMenu', () => {
    return jest.fn().mockImplementation(() => {
        return {
            reload: mockContextMenuReload,
            dispose: mockContextMenuDispose,
        };
    });
});

describe('main/windows/callsWidgetWindow', () => {
    describe('onShow', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.win = {
            focus: jest.fn(),
            setVisibleOnAllWorkspaces: jest.fn(),
            setAlwaysOnTop: jest.fn(),
            getBounds: jest.fn(),
            setBounds: jest.fn(),
            setMenuBarVisibility: jest.fn(),
            webContents: {
                openDevTools: jest.fn(),
            },
        };
        const mainWindow = {
            getBounds: jest.fn(),
        };

        beforeEach(() => {
            mainWindow.getBounds.mockReturnValue({
                x: 0,
                y: 0,
                width: 1280,
                height: 720,
            });
            callsWidgetWindow.win.getBounds.mockReturnValue({
                x: 0,
                y: 0,
                width: MINIMUM_CALLS_WIDGET_WIDTH,
                height: MINIMUM_CALLS_WIDGET_HEIGHT,
            });
            MainWindow.get.mockReturnValue(mainWindow);
        });

        it('should call certain functions upon showing the window', () => {
            callsWidgetWindow.onShow();
            expect(callsWidgetWindow.win.setAlwaysOnTop).toHaveBeenCalled();
            expect(callsWidgetWindow.win.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 618,
                width: MINIMUM_CALLS_WIDGET_WIDTH,
                height: MINIMUM_CALLS_WIDGET_HEIGHT,
            });
            expect(ipcMain.emit).toHaveBeenCalledWith(UPDATE_SHORTCUT_MENU);
        });

        it('should open dev tools when environment variable is set', async () => {
            const originalEnv = process.env;
            Object.defineProperty(process, 'env', {
                value: {
                    MM_DEBUG_CALLS_WIDGET: 'true',
                },
            });
            callsWidgetWindow.onShow();
            expect(callsWidgetWindow.win.webContents.openDevTools).toHaveBeenCalled();
            Object.defineProperty(process, 'env', {
                value: originalEnv,
            });
        });

        it('widget window visibility should have been toggled', async () => {
            callsWidgetWindow.onShow();
            expect(callsWidgetWindow.win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {skipTransformProcessType: true, visibleOnFullScreen: true});
            expect(callsWidgetWindow.win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
            expect(callsWidgetWindow.win.focus).toHaveBeenCalled();
        });
    });

    describe('close', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.win = {
            on: jest.fn(),
            close: jest.fn(),
            isDestroyed: jest.fn(),
            webContents: {
                id: 1,
            },
        };

        beforeEach(() => {
            let closedListener;
            callsWidgetWindow.win.on.mockImplementation((event, listener) => {
                closedListener = listener;
            });
            callsWidgetWindow.win.close.mockImplementation(() => closedListener());
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should close window', async () => {
            await callsWidgetWindow.close();
            expect(callsWidgetWindow.win.close).toHaveBeenCalled();
        });

        it('should not close if already destroyed', async () => {
            callsWidgetWindow.win.isDestroyed.mockReturnValue(true);
            await callsWidgetWindow.close();
            expect(callsWidgetWindow.win.close).not.toHaveBeenCalled();
        });
    });

    describe('handleResize', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.win = {
            getBounds: jest.fn(),
            webContents: {
                id: 'windowID',
                getZoomFactor: jest.fn(),
            },
        };
        callsWidgetWindow.setBounds = jest.fn();
        const bounds = {
            x: 12,
            y: 720,
            width: MINIMUM_CALLS_WIDGET_WIDTH,
            height: MINIMUM_CALLS_WIDGET_HEIGHT,
        };

        beforeEach(() => {
            callsWidgetWindow.win.getBounds.mockReturnValue(bounds);
            callsWidgetWindow.win.webContents.getZoomFactor.mockReturnValue(1.0);
        });

        it('should resize correctly', () => {
            callsWidgetWindow.handleResize({
                sender: {id: 'windowID'},
            }, 300, 100);
            expect(callsWidgetWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 720 - (100 - MINIMUM_CALLS_WIDGET_HEIGHT),
                width: 300,
                height: 100,
            });
        });

        it('should resize correctly at 2x zoom', () => {
            callsWidgetWindow.win.webContents.getZoomFactor.mockReturnValue(2.0);
            callsWidgetWindow.handleResize({
                sender: {id: 'windowID'},
            }, 300, 100);
            expect(callsWidgetWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 720 - (200 - MINIMUM_CALLS_WIDGET_HEIGHT),
                width: 600,
                height: 200,
            });
        });

        it('should resize correctly at 0.5x zoom', () => {
            callsWidgetWindow.win.webContents.getZoomFactor.mockReturnValue(0.5);
            callsWidgetWindow.handleResize({
                sender: {id: 'windowID'},
            }, 300, 100);
            expect(callsWidgetWindow.setBounds).toHaveBeenCalledWith({
                x: 12,
                y: 720 - (50 - MINIMUM_CALLS_WIDGET_HEIGHT),
                width: 150,
                height: 50,
            });
        });
    });

    describe('getWidgetURL', () => {
        const callsWidgetWindow = new CallsWidgetWindow();

        beforeEach(() => {
            urlUtils.parseURL.mockImplementation((url) => new URL(url));
            urlUtils.getFormattedPathName.mockImplementation((pn) => {
                return pn.endsWith('/') ? pn : `${pn}/`;
            });
            callsWidgetWindow.options = {
                callID: 'test-call-id',
                channelURL: '/team/channel_id',
                title: 'call test title #/&',
            };
            callsWidgetWindow.mainView = {
                view: {
                    server: {
                        url: new URL('http://localhost:8065'),
                    },
                },
            };
        });

        it('getWidgetURL', () => {
            const expected = `http://localhost:8065/plugins/${CALLS_PLUGIN_ID}/standalone/widget.html?call_id=test-call-id&title=call+test+title+%23%2F%26`;
            expect(callsWidgetWindow.getWidgetURL()).toBe(expected);
        });

        it('getWidgetURL - under subpath', () => {
            callsWidgetWindow.mainView = {
                view: {
                    server: {
                        url: new URL('http://localhost:8065/subpath'),
                    },
                },
            };

            const expected = `http://localhost:8065/subpath/plugins/${CALLS_PLUGIN_ID}/standalone/widget.html?call_id=test-call-id&title=call+test+title+%23%2F%26`;
            expect(callsWidgetWindow.getWidgetURL()).toBe(expected);
        });

        it('getWidgetURL - with rootID', () => {
            callsWidgetWindow.options = {
                ...callsWidgetWindow.options,
                rootID: 'call_thread_id',
            };
            const expected = `http://localhost:8065/plugins/${CALLS_PLUGIN_ID}/standalone/widget.html?call_id=test-call-id&title=call+test+title+%23%2F%26&root_id=call_thread_id`;
            expect(callsWidgetWindow.getWidgetURL()).toBe(expected);
        });
    });

    it('handleShareScreen', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.isAllowedEvent = jest.fn();
        callsWidgetWindow.mainView = {
            webContentsId: 'goodID',
        };
        callsWidgetWindow.win = {
            webContents: {
                send: jest.fn(),
            },
        };

        callsWidgetWindow.isAllowedEvent.mockReturnValue(false);
        callsWidgetWindow.handleShareScreen({
            sender: {id: 'badID'},
        }, 'sourceId', true);
        expect(callsWidgetWindow.win.webContents.send).not.toHaveBeenCalled();

        callsWidgetWindow.isAllowedEvent.mockReturnValue(true);
        callsWidgetWindow.handleShareScreen({
            sender: {id: 'goodID'},
        }, 'sourceId', true);
        expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith(CALLS_WIDGET_SHARE_SCREEN, 'sourceId', true);
    });

    describe('onPopOutOpen', () => {
        const callsWidgetWindow = new CallsWidgetWindow();

        beforeEach(() => {
            callsWidgetWindow.options = {callID: 'id'};
            callsWidgetWindow.mainView = {
                view: {
                    server: {
                        url: new URL('http://localhost:8065'),
                    },
                },
            };
        });

        afterEach(() => {
            jest.clearAllMocks();
            delete callsWidgetWindow.options;
            delete callsWidgetWindow.mainView;
        });

        it('should deny opening if there is no call attached', () => {
            delete callsWidgetWindow.options;
            delete callsWidgetWindow.mainView;
            expect(callsWidgetWindow.onPopOutOpen({url: 'http://localhost:8065/popouturl'})).toHaveProperty('action', 'deny');
        });

        it('should pop out and make sure menu bar is disabled', () => {
            urlUtils.isCallsPopOutURL.mockReturnValue(true);
            expect(callsWidgetWindow.onPopOutOpen({url: 'http://localhost:8065/popouturl'})).toHaveProperty('action', 'allow');
            expect(callsWidgetWindow.onPopOutOpen({url: 'http://localhost:8065/popouturl'}).overrideBrowserWindowOptions).toHaveProperty('autoHideMenuBar', true);
        });

        it('should not pop out when the URL does not match the calls popout URL', () => {
            urlUtils.isCallsPopOutURL.mockReturnValue(false);
            expect(callsWidgetWindow.onPopOutOpen({url: 'http://localhost:8065/notpopouturl'})).toHaveProperty('action', 'deny');
        });

        it('should pop out and make sure preload is set', () => {
            urlUtils.isCallsPopOutURL.mockReturnValue(true);
            expect(callsWidgetWindow.onPopOutOpen({url: 'http://localhost:8065/popouturl'})).toHaveProperty('action', 'allow');
            expect(callsWidgetWindow.onPopOutOpen({url: 'http://localhost:8065/popouturl'})).toHaveProperty('overrideBrowserWindowOptions.webPreferences.preload', 'externalAPI.js');
        });
    });

    describe('handlePopOutFocus', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.popOut = {
            isMinimized: jest.fn(),
            restore: jest.fn(),
            focus: jest.fn(),
        };

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should focus only if not minimized', () => {
            callsWidgetWindow.popOut.isMinimized.mockReturnValue(false);
            callsWidgetWindow.handlePopOutFocus();
            expect(callsWidgetWindow.popOut.restore).not.toBeCalled();
            expect(callsWidgetWindow.popOut.focus).toBeCalled();
        });

        it('should focus only if not minimized', () => {
            callsWidgetWindow.popOut.isMinimized.mockReturnValue(true);
            callsWidgetWindow.handlePopOutFocus();
            expect(callsWidgetWindow.popOut.restore).toBeCalled();
            expect(callsWidgetWindow.popOut.focus).toBeCalled();
        });
    });

    it('onPopOutCreate - should attach correct listeners and should prevent redirects', () => {
        let redirectListener;
        let closedListener;
        let frameFinishedLoadListener;
        const popOut = {
            on: (event, listener) => {
                closedListener = listener;
            },
            webContents: {
                on: (event, listener) => {
                    redirectListener = listener;
                },
                once: (event, listener) => {
                    frameFinishedLoadListener = listener;
                },
                id: 'webContentsId',
                getURL: () => ('http://myurl.com'),
                removeListener: jest.fn(),
            },
            off: jest.fn(),
            loadURL: jest.fn(),
            isDestroyed: jest.fn(() => false),
        };

        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.win = {
            setVisibleOnAllWorkspaces: jest.fn(),
            setAlwaysOnTop: jest.fn(),
            focus: jest.fn(),
        };

        expect(callsWidgetWindow.win.setVisibleOnAllWorkspaces).not.toHaveBeenCalled();
        expect(callsWidgetWindow.win.setAlwaysOnTop).not.toHaveBeenCalled();

        callsWidgetWindow.onPopOutCreate(popOut);

        // Verify widget visibility has been toggled
        expect(callsWidgetWindow.win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(false);
        expect(callsWidgetWindow.win.setAlwaysOnTop).toHaveBeenCalledWith(false);
        expect(callsWidgetWindow.win.focus).not.toHaveBeenCalled();

        expect(callsWidgetWindow.popOut).toBe(popOut);
        expect(WebContentsEventManager.addWebContentsEventListeners).toHaveBeenCalledWith(popOut.webContents);
        expect(redirectListener).toBeDefined();
        expect(frameFinishedLoadListener).toBeDefined();
        expect(mockContextMenuReload).toHaveBeenCalledTimes(1);

        const event = {preventDefault: jest.fn()};
        redirectListener(event);
        expect(event.preventDefault).toHaveBeenCalled();

        frameFinishedLoadListener();
        expect(callsWidgetWindow.popOut.loadURL).toHaveBeenCalledTimes(1);

        closedListener();
        expect(callsWidgetWindow.popOut).not.toBeDefined();
        expect(mockContextMenuDispose).toHaveBeenCalled();

        // Verify widget visibility has been toggled
        expect(callsWidgetWindow.win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {skipTransformProcessType: true, visibleOnFullScreen: true});
        expect(callsWidgetWindow.win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
        expect(callsWidgetWindow.win.focus).toHaveBeenCalled();
    });

    it('getViewURL', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = {
            view: {
                server: {
                    url: new URL('http://localhost:8065/'),
                },
            },
        };
        expect(callsWidgetWindow.getViewURL().toString()).toBe('http://localhost:8065/');
    });

    it('onNavigate', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.getWidgetURL = () => 'http://localhost:8065';
        const ev = {preventDefault: jest.fn()};

        callsWidgetWindow.onNavigate(ev, 'http://localhost:8065');
        expect(ev.preventDefault).not.toHaveBeenCalled();

        callsWidgetWindow.onNavigate(ev, 'http://localhost:8065/invalid/url');
        expect(ev.preventDefault).toHaveBeenCalledTimes(1);
    });

    describe('handleCreateCallsWidgetWindow', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.close = jest.fn();
        callsWidgetWindow.getWidgetURL = jest.fn();
        const view = {
            name: 'server-1_view-messaging',
            serverInfo: {
                server: {
                    url: new URL('http://server-1.com'),
                },
            },
            webContentsId: 2,
        };
        const browserWindow = {
            on: jest.fn(),
            once: jest.fn(),
            loadURL: jest.fn(),
            webContents: {
                setWindowOpenHandler: jest.fn(),
                on: jest.fn(),
                id: 1,
                openDevTools: jest.fn(),
            },
        };

        beforeEach(() => {
            let func;
            ipcMain.on.mockImplementation((_, callback) => {
                func = callback;
            });
            browserWindow.loadURL.mockImplementation(() => {
                func({sender: {id: 1}}, 'test');
                return Promise.resolve();
            });
            BrowserWindow.mockReturnValue(browserWindow);
            callsWidgetWindow.close.mockReturnValue(Promise.resolve());
            callsWidgetWindow.getWidgetURL.mockReturnValue('http://server-1.com/widget');
            ViewManager.getViewByWebContentsId.mockReturnValue(view);
        });

        afterEach(() => {
            delete callsWidgetWindow.win;
            delete callsWidgetWindow.mainView;
            delete callsWidgetWindow.options;

            jest.resetAllMocks();
        });

        it('should create calls widget window', async () => {
            expect(callsWidgetWindow.win).toBeUndefined();
            await callsWidgetWindow.handleCreateCallsWidgetWindow({sender: {id: 2}}, {callID: 'test'});
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
            expect(callsWidgetWindow.win).toBeDefined();
        });

        it('should catch error when failing to load the URL', async () => {
            const error = new Error('failed to load URL');
            const promise = Promise.reject(error);
            BrowserWindow.mockReturnValue({
                ...browserWindow,
                loadURL: jest.fn().mockReturnValue(promise),
            });

            await expect(promise).rejects.toThrow(error);
        });

        it('should not create a new window if call is the same', async () => {
            const window = {webContents: {id: 3}};
            callsWidgetWindow.win = window;
            callsWidgetWindow.options = {callID: 'test'};
            await callsWidgetWindow.handleCreateCallsWidgetWindow({sender: {id: 2}}, {callID: 'test'});
            expect(callsWidgetWindow.win).toEqual(window);
        });

        it('should create a new window if switching calls', async () => {
            let func;
            ipcMain.on.mockImplementation((_, callback) => {
                func = callback;
            });
            browserWindow.loadURL.mockImplementation(() => {
                func({sender: {id: 1}}, 'test2');
                return Promise.resolve();
            });
            BrowserWindow.mockReturnValue(browserWindow);

            const window = {webContents: {id: 3}};
            callsWidgetWindow.win = window;
            callsWidgetWindow.options = {callID: 'test'};
            await callsWidgetWindow.handleCreateCallsWidgetWindow({sender: {id: 2}}, {callID: 'test2'});
            expect(callsWidgetWindow.win).not.toEqual(window);
        });
    });

    describe('handleGetDesktopSources', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.win = {
            webContents: {
                send: jest.fn(),
            },
        };
        const servers = [
            {
                name: 'server-1',
                order: 1,
                views: [
                    {
                        name: 'view-1',
                        order: 0,
                        isOpen: false,
                    },
                    {
                        name: 'view-2',
                        order: 2,
                        isOpen: true,
                    },
                ],
            }, {
                name: 'server-2',
                order: 0,
                views: [
                    {
                        name: 'view-1',
                        order: 0,
                        isOpen: false,
                    },
                    {
                        name: 'view-2',
                        order: 2,
                        isOpen: true,
                    },
                ],
                lastActiveView: 2,
            },
        ];
        let index = 0;
        const map = servers.reduce((arr, item) => {
            item.views.forEach((view) => {
                index++;
                arr.push([`${item.name}_${view.name}`, {
                    sendToRenderer: jest.fn(),
                    webContentsId: index,
                    view: {
                        server: {
                            url: new URL('http://server-1.com'),
                        },
                    },
                }]);
            });
            return arr;
        }, []);
        const views = new Map(map);

        beforeEach(() => {
            PermissionsManager.doPermissionRequest.mockReturnValue(Promise.resolve(true));
            ViewManager.getViewByWebContentsId.mockImplementation((id) => [...views.values()].find((view) => view.webContentsId === id));
            callsWidgetWindow.mainView = views.get('server-1_view-1');
            callsWidgetWindow.options = {callID: 'callID'};
        });

        afterEach(() => {
            jest.resetAllMocks();
            callsWidgetWindow.missingScreensharePermissions = undefined;
        });

        it('should send sources back - uninitialized', async () => {
            callsWidgetWindow.mainView = undefined;
            jest.spyOn(desktopCapturer, 'getSources').mockResolvedValue([
                {
                    id: 'screen0',
                    thumbnail: {
                        toDataURL: jest.fn(),
                    },
                },
                {
                    id: 'window0',
                    thumbnail: {
                        toDataURL: jest.fn(),
                    },
                },
            ]);

            const sources = await callsWidgetWindow.handleGetDesktopSources({sender: {id: 1}}, null);
            expect(sources).toEqual([
                {
                    id: 'screen0',
                },
                {
                    id: 'window0',
                },
            ]);
        });

        it('should send sources back', async () => {
            jest.spyOn(desktopCapturer, 'getSources').mockResolvedValue([
                {
                    id: 'screen0',
                    thumbnail: {
                        toDataURL: jest.fn(),
                    },
                },
                {
                    id: 'window0',
                    thumbnail: {
                        toDataURL: jest.fn(),
                    },
                },
            ]);

            const sources = await callsWidgetWindow.handleGetDesktopSources({sender: {id: 1}}, null);
            expect(sources).toEqual([
                {
                    id: 'screen0',
                },
                {
                    id: 'window0',
                },
            ]);
        });

        it('should throw and send error with no sources', async () => {
            jest.spyOn(desktopCapturer, 'getSources').mockResolvedValue([]);

            await expect(callsWidgetWindow.handleGetDesktopSources({sender: {id: 1}}, null)).rejects.toThrow('permissions denied');

            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith('calls-error', 'screen-permissions', 'callID');
            expect(views.get('server-1_view-1').sendToRenderer).toHaveBeenCalledWith('calls-error', 'screen-permissions', 'callID');
            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledTimes(1);
        });

        it('should throw but not send calls error when uninitialized', async () => {
            callsWidgetWindow.options = undefined;

            jest.spyOn(desktopCapturer, 'getSources').mockResolvedValue([]);

            await expect(callsWidgetWindow.handleGetDesktopSources({sender: {id: 1}}, null)).rejects.toThrow('permissions denied');

            expect(callsWidgetWindow.win.webContents.send).not.toHaveBeenCalled();
            expect(views.get('server-1_view-1').sendToRenderer).not.toHaveBeenCalled();
        });

        it('should throw and send error with no permissions', async () => {
            jest.spyOn(desktopCapturer, 'getSources').mockResolvedValue([
                {
                    id: 'screen0',
                    thumbnail: {
                        toDataURL: jest.fn(),
                    },
                },
            ]);
            jest.spyOn(systemPreferences, 'getMediaAccessStatus').mockReturnValue('denied');

            await expect(callsWidgetWindow.handleGetDesktopSources({sender: {id: 1}}, null)).rejects.toThrow('permissions denied');

            expect(systemPreferences.getMediaAccessStatus).toHaveBeenCalledWith('screen');
            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith('calls-error', 'screen-permissions', 'callID');
            expect(views.get('server-1_view-1').sendToRenderer).toHaveBeenCalledWith('calls-error', 'screen-permissions', 'callID');
            expect(views.get('server-1_view-1').sendToRenderer).toHaveBeenCalledTimes(1);
            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledTimes(1);
        });

        it('should throw but not send error with no permissions when uninitialized', async () => {
            callsWidgetWindow.options = undefined;

            jest.spyOn(desktopCapturer, 'getSources').mockResolvedValue([
                {
                    id: 'screen0',
                    thumbnail: {
                        toDataURL: jest.fn(),
                    },
                },
            ]);
            jest.spyOn(systemPreferences, 'getMediaAccessStatus').mockReturnValue('denied');

            await expect(callsWidgetWindow.handleGetDesktopSources({sender: {id: 1}}, null)).rejects.toThrow('permissions denied');

            expect(systemPreferences.getMediaAccessStatus).toHaveBeenCalledWith('screen');

            expect(callsWidgetWindow.win.webContents.send).not.toHaveBeenCalled();
            expect(views.get('server-1_view-1').sendToRenderer).not.toHaveBeenCalled();
        });

        it('macos - no permissions', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            jest.spyOn(desktopCapturer, 'getSources').mockResolvedValue([
                {
                    id: 'screen0',
                    thumbnail: {
                        toDataURL: jest.fn(),
                    },
                },
            ]);
            jest.spyOn(systemPreferences, 'getMediaAccessStatus').mockReturnValue('denied');

            await expect(callsWidgetWindow.handleGetDesktopSources({sender: {id: 1}}, null)).rejects.toThrow('permissions denied');

            expect(callsWidgetWindow.missingScreensharePermissions).toBe(true);
            expect(resetScreensharePermissionsMacOS).toHaveBeenCalledTimes(1);
            expect(openScreensharePermissionsSettingsMacOS).toHaveBeenCalledTimes(0);
            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith('calls-error', 'screen-permissions', 'callID');
            expect(views.get('server-1_view-1').sendToRenderer).toHaveBeenCalledWith('calls-error', 'screen-permissions', 'callID');

            await expect(callsWidgetWindow.handleGetDesktopSources({sender: {id: 1}}, null)).rejects.toThrow('permissions denied');

            expect(resetScreensharePermissionsMacOS).toHaveBeenCalledTimes(2);
            expect(openScreensharePermissionsSettingsMacOS).toHaveBeenCalledTimes(1);

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('forwardToMainApp', () => {
        const view = {
            id: 'main-view',
            view: {
                server: {
                    id: 'server-1',
                },
            },
            sendToRenderer: jest.fn(),
        };
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = view;
        callsWidgetWindow.win = {webContents: {id: 1}};

        const focus = jest.fn();

        beforeEach(() => {
            MainWindow.get.mockReturnValue({focus});
            ViewManager.getView.mockReturnValue(view);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should pass through the arguments to the webapp', () => {
            const func = callsWidgetWindow.forwardToMainApp('some-channel');
            func({sender: {id: 1}}, 'thecallchannelid');
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-1');
            expect(ViewManager.showById).toHaveBeenCalledWith('main-view');
            expect(focus).toHaveBeenCalled();
            expect(view.sendToRenderer).toBeCalledWith('some-channel', 'thecallchannelid');
        });
    });

    describe('handleCallsLinkClick', () => {
        const view = {
            id: 'main-view',
            view: {
                server: {
                    id: 'server-1',
                },
            },
            sendToRenderer: jest.fn(),
        };
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = view;
        callsWidgetWindow.win = {webContents: {id: 1}};

        const focus = jest.fn();

        beforeEach(() => {
            urlUtils.parseURL.mockImplementation((url) => {
                try {
                    return new URL(url);
                } catch (e) {
                    return undefined;
                }
            });
            MainWindow.get.mockReturnValue({focus});
            ViewManager.getView.mockReturnValue(view);
            ViewManager.handleDeepLink = jest.fn();
        });

        it('should switch server, tab and focus and send history push event', () => {
            const url = '/team/channel';
            callsWidgetWindow.handleCallsLinkClick({sender: {id: 1}}, url);
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-1');
            expect(ViewManager.showById).toHaveBeenCalledWith('main-view');
            expect(focus).toHaveBeenCalled();
            expect(view.sendToRenderer).toBeCalledWith(BROWSER_HISTORY_PUSH, url);
        });

        it('should call ViewManager.handleDeepLink for parseable urls', () => {
            const url = 'http://localhost:8065/team/channel';
            callsWidgetWindow.handleCallsLinkClick({sender: {id: 1}}, url);
            expect(ViewManager.handleDeepLink).toHaveBeenCalledWith(new URL(url));
        });
    });

    describe('isOpen', () => {
        const callsWidgetWindow = new CallsWidgetWindow();

        it('undefined', () => {
            expect(callsWidgetWindow.isOpen()).toBe(false);
        });

        it('open', () => {
            callsWidgetWindow.win = {
                isDestroyed: jest.fn(() => false),
            };
            expect(callsWidgetWindow.isOpen()).toBe(true);
        });

        it('destroyed', () => {
            callsWidgetWindow.win = {
                isDestroyed: jest.fn(() => true),
            };
            expect(callsWidgetWindow.isOpen()).toBe(false);
        });
    });

    describe('handleCallsOpenThread', () => {
        const view = {
            id: 'main-view',
            view: {
                server: {
                    id: 'server-1',
                },
            },
            sendToRenderer: jest.fn(),
        };
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = view;
        callsWidgetWindow.win = {webContents: {id: 1}};

        const focus = jest.fn();

        beforeEach(() => {
            MainWindow.get.mockReturnValue({focus});
            ViewManager.getView.mockReturnValue(view);
            ViewManager.handleDeepLink = jest.fn();
        });

        it('should switch server, tab and focus and send open thread event', () => {
            const threadID = 'call-thread-id';
            callsWidgetWindow.handleCallsOpenThread({sender: {id: 1}}, threadID);
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-1');
            expect(ViewManager.showById).toHaveBeenCalledWith('main-view');
            expect(focus).toHaveBeenCalled();
            expect(view.sendToRenderer).toBeCalledWith(CALLS_WIDGET_OPEN_THREAD, threadID);
        });
    });

    describe('handleCallsOpenStopRecordingModal', () => {
        const view = {
            id: 'main-view',
            view: {
                server: {
                    id: 'server-1',
                },
            },
            sendToRenderer: jest.fn(),
        };
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = view;
        callsWidgetWindow.win = {webContents: {id: 1}};

        const focus = jest.fn();

        beforeEach(() => {
            MainWindow.get.mockReturnValue({focus});
            ViewManager.getView.mockReturnValue(view);
        });

        it('should switch server, tab and focus and send open modal event', () => {
            const channelID = 'call-channel-id';
            callsWidgetWindow.handleCallsOpenStopRecordingModal({sender: {id: 1}}, channelID);
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-1');
            expect(ViewManager.showById).toHaveBeenCalledWith('main-view');
            expect(focus).toHaveBeenCalled();
            expect(view.sendToRenderer).toBeCalledWith(CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL, channelID);
        });
    });

    describe('focusChannelView', () => {
        const view = {
            id: 'main-view',
            view: {
                server: {
                    id: 'server-1',
                },
            },
            sendToRenderer: jest.fn(),
        };

        const callsWidgetWindow = new CallsWidgetWindow();

        const focus = jest.fn();

        beforeEach(() => {
            MainWindow.get.mockReturnValue({focus});
            ViewManager.getView.mockReturnValue(view);
        });

        it('noop if not initialized', () => {
            callsWidgetWindow.focusChannelView();
            expect(ServerViewState.switchServer).not.toHaveBeenCalled();
            expect(ViewManager.showById).not.toHaveBeenCalled();
            expect(focus).not.toHaveBeenCalled();
        });

        it('should switch server, tab and focus', () => {
            callsWidgetWindow.mainView = view;
            callsWidgetWindow.focusChannelView();
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-1');
            expect(ViewManager.showById).toHaveBeenCalledWith('main-view');
            expect(focus).toHaveBeenCalled();
        });
    });
});
