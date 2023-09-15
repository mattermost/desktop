// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import {BrowserWindow, desktopCapturer, systemPreferences} from 'electron';

import ServerViewState from 'app/serverViewState';

import {CALLS_WIDGET_SHARE_SCREEN, CALLS_JOINED_CALL, CALLS_JOIN_REQUEST} from 'common/communication';
import {
    MINIMUM_CALLS_WIDGET_WIDTH,
    MINIMUM_CALLS_WIDGET_HEIGHT,
    CALLS_PLUGIN_ID,
} from 'common/utils/constants';
import urlUtils from 'common/utils/url';

import MainWindow from 'main/windows/mainWindow';
import ViewManager from 'main/views/viewManager';
import {
    resetScreensharePermissionsMacOS,
    openScreensharePermissionsSettingsMacOS,
} from 'main/utils';
import WebContentsEventManager from 'main/views/webContentEvents';

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
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
    focus: jest.fn(),
}));
jest.mock('app/serverViewState', () => ({
    switchServer: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({
    getView: jest.fn(),
}));
jest.mock('../utils', () => ({
    openScreensharePermissionsSettingsMacOS: jest.fn(),
    resetScreensharePermissionsMacOS: jest.fn(),
    getLocalPreload: jest.fn(),
    composeUserAgent: jest.fn(),
}));

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
    });

    describe('close', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.win = {
            on: jest.fn(),
            close: jest.fn(),
            isDestroyed: jest.fn(),
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
            }, 'widget', {
                element: 'calls-widget',
                width: 300,
                height: 100,
            });
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
            }, 'widget', {
                element: 'calls-widget',
                width: 300,
                height: 100,
            });
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
            }, 'widget', {
                element: 'calls-widget',
                width: 300,
                height: 100,
            });
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
        callsWidgetWindow.win = {
            webContents: {
                id: 'goodID',
                send: jest.fn(),
            },
        };
        const message = {
            callID: 'test-call-id',
        };

        callsWidgetWindow.isAllowedEvent.mockReturnValue(false);
        callsWidgetWindow.handleShareScreen({
            sender: {id: 'badID'},
        }, message);
        expect(callsWidgetWindow.win.webContents.send).not.toHaveBeenCalled();

        callsWidgetWindow.isAllowedEvent.mockReturnValue(true);
        callsWidgetWindow.handleShareScreen({
            sender: {id: 'goodID'},
        }, 'widget', message);
        expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith(CALLS_WIDGET_SHARE_SCREEN, message);
    });

    it('handleJoinedCall', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.isAllowedEvent = jest.fn();
        callsWidgetWindow.mainView = {
            webContentsId: 'goodID',
            sendToRenderer: jest.fn(),
        };
        const message = {
            callID: 'test-call-id',
        };

        callsWidgetWindow.isAllowedEvent.mockReturnValue(false);
        callsWidgetWindow.handleJoinedCall({
            sender: {id: 'badID'},
        }, 'widget', message);
        expect(callsWidgetWindow.mainView.sendToRenderer).not.toHaveBeenCalled();

        callsWidgetWindow.isAllowedEvent.mockReturnValue(true);
        callsWidgetWindow.handleJoinedCall({
            sender: {id: 'goodID'},
        }, 'widget', message);
        expect(callsWidgetWindow.mainView.sendToRenderer).toHaveBeenCalledWith(CALLS_JOINED_CALL, message);
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
            },
            loadURL: jest.fn(),
        };

        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.onPopOutCreate(popOut);
        expect(callsWidgetWindow.popOut).toBe(popOut);
        expect(WebContentsEventManager.addWebContentsEventListeners).toHaveBeenCalledWith(popOut.webContents);
        expect(redirectListener).toBeDefined();
        expect(frameFinishedLoadListener).toBeDefined();

        const event = {preventDefault: jest.fn()};
        redirectListener(event);
        expect(event.preventDefault).toHaveBeenCalled();

        frameFinishedLoadListener();
        expect(callsWidgetWindow.popOut.loadURL).toHaveBeenCalledTimes(1);

        closedListener();
        expect(callsWidgetWindow.popOut).not.toBeDefined();
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

    describe('isAllowedEvent', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = {
            webContentsId: 'mainViewID',
        };
        callsWidgetWindow.win = {
            webContents: {
                id: 'windowID',
            },
        };

        it('should not allow on unknown sender id', () => {
            expect(callsWidgetWindow.isAllowedEvent({
                sender: {
                    id: 'senderID',
                },
            })).toEqual(false);
        });

        it('should allow on attached browser view', () => {
            expect(callsWidgetWindow.isAllowedEvent({
                sender: {
                    id: 'mainViewID',
                },
            })).toEqual(true);
        });

        it('should allow on widget window', () => {
            expect(callsWidgetWindow.isAllowedEvent({
                sender: {
                    id: 'windowID',
                },
            })).toEqual(true);
        });
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
        };
        const browserWindow = {
            on: jest.fn(),
            once: jest.fn(),
            loadURL: jest.fn().mockReturnValue(Promise.resolve()),
            webContents: {
                setWindowOpenHandler: jest.fn(),
                on: jest.fn(),
                id: 1,
                openDevTools: jest.fn(),
            },
        };

        beforeEach(() => {
            BrowserWindow.mockReturnValue(browserWindow);
            callsWidgetWindow.close.mockReturnValue(Promise.resolve());
            ViewManager.getView.mockReturnValue(view);
        });

        afterEach(() => {
            delete callsWidgetWindow.win;
            delete callsWidgetWindow.mainView;
            delete callsWidgetWindow.options;

            jest.resetAllMocks();
        });

        it('should create calls widget window', async () => {
            expect(callsWidgetWindow.win).toBeUndefined();
            await callsWidgetWindow.handleCreateCallsWidgetWindow('server-1_view-messaging', {callID: 'test'});
            expect(callsWidgetWindow.win).toBeDefined();
        });

        it('should create with correct initial configuration', async () => {
            await callsWidgetWindow.handleCreateCallsWidgetWindow('server-1_view-messaging', {callID: 'test'});
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
            const window = {webContents: {id: 2}};
            callsWidgetWindow.win = window;
            callsWidgetWindow.options = {callID: 'test'};
            await callsWidgetWindow.handleCreateCallsWidgetWindow('server-1_view-messaging', {callID: 'test'});
            expect(callsWidgetWindow.win).toEqual(window);
        });

        it('should create a new window if switching calls', async () => {
            const window = {webContents: {id: 2}};
            callsWidgetWindow.win = window;
            callsWidgetWindow.getCallID = jest.fn(() => 'test');
            await callsWidgetWindow.handleCreateCallsWidgetWindow('server-1_view-messaging', {callID: 'test2'});
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
        const map = servers.reduce((arr, item) => {
            item.views.forEach((view) => {
                arr.push([`${item.name}_${view.name}`, {
                    sendToRenderer: jest.fn(),
                }]);
            });
            return arr;
        }, []);
        const views = new Map(map);

        beforeEach(() => {
            ViewManager.getView.mockImplementation((viewId) => views.get(viewId));
        });

        afterEach(() => {
            jest.resetAllMocks();
            callsWidgetWindow.missingScreensharePermissions = undefined;
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

            await callsWidgetWindow.handleGetDesktopSources('server-1_view-1', null);

            expect(views.get('server-1_view-1').sendToRenderer).toHaveBeenCalledWith('desktop-sources-result', [
                {
                    id: 'screen0',
                },
                {
                    id: 'window0',
                },
            ]);
        });

        it('should send error with no sources', async () => {
            jest.spyOn(desktopCapturer, 'getSources').mockResolvedValue([]);
            await callsWidgetWindow.handleGetDesktopSources('server-2_view-1', null);
            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(views.get('server-2_view-1').sendToRenderer).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledTimes(1);
        });

        it('should send error with no permissions', async () => {
            jest.spyOn(desktopCapturer, 'getSources').mockResolvedValue([
                {
                    id: 'screen0',
                    thumbnail: {
                        toDataURL: jest.fn(),
                    },
                },
            ]);
            jest.spyOn(systemPreferences, 'getMediaAccessStatus').mockReturnValue('denied');

            await callsWidgetWindow.handleGetDesktopSources('server-1_view-1', null);

            expect(systemPreferences.getMediaAccessStatus).toHaveBeenCalledWith('screen');
            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(views.get('server-1_view-1').sendToRenderer).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(views.get('server-1_view-1').sendToRenderer).toHaveBeenCalledTimes(1);
            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledTimes(1);
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

            await callsWidgetWindow.handleGetDesktopSources('server-1_view-1', null);

            expect(callsWidgetWindow.missingScreensharePermissions).toBe(true);
            expect(resetScreensharePermissionsMacOS).toHaveBeenCalledTimes(1);
            expect(openScreensharePermissionsSettingsMacOS).toHaveBeenCalledTimes(0);
            expect(callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(views.get('server-1_view-1').sendToRenderer).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });

            await callsWidgetWindow.handleGetDesktopSources('server-1_view-1', null);

            expect(resetScreensharePermissionsMacOS).toHaveBeenCalledTimes(2);
            expect(openScreensharePermissionsSettingsMacOS).toHaveBeenCalledTimes(1);

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('handleDesktopSourcesModalRequest', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = {
            view: {
                server: {
                    id: 'server-1',
                },
            },
            sendToRenderer: jest.fn(),
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
        const map = servers.reduce((arr, item) => {
            item.views.forEach((view) => {
                arr.push([`${item.name}_${view.name}`, {}]);
            });
            return arr;
        }, []);
        const views = new Map(map);

        beforeEach(() => {
            ViewManager.getView.mockImplementation((viewId) => views.get(viewId));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should switch server', () => {
            callsWidgetWindow.handleDesktopSourcesModalRequest();
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-1');
        });
    });

    describe('handleCallsWidgetChannelLinkClick', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = {
            view: {
                server: {
                    id: 'server-2',
                },
            },
            sendToRenderer: jest.fn(),
        };
        callsWidgetWindow.getChannelURL = jest.fn();
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
        const map = servers.reduce((arr, item) => {
            item.views.forEach((view) => {
                arr.push([`${item.name}_${view.name}`, {}]);
            });
            return arr;
        }, []);
        const views = new Map(map);

        beforeEach(() => {
            ViewManager.getView.mockImplementation((viewId) => views.get(viewId));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should switch server', () => {
            callsWidgetWindow.handleCallsWidgetChannelLinkClick();
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-2');
        });
    });

    describe('handleCallsError', () => {
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = {
            view: {
                server: {
                    id: 'server-2',
                },
            },
            sendToRenderer: jest.fn(),
        };
        const focus = jest.fn();

        beforeEach(() => {
            MainWindow.get.mockReturnValue({focus});
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should focus view and propagate error to main view', () => {
            callsWidgetWindow.handleCallsError('', {err: 'client-error'});
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-2');
            expect(focus).toHaveBeenCalled();
            expect(callsWidgetWindow.mainView.sendToRenderer).toHaveBeenCalledWith('calls-error', {err: 'client-error'});
        });
    });

    describe('handleCallsLinkClick', () => {
        const view = {
            view: {
                server: {
                    id: 'server-1',
                },
            },
            sendToRenderer: jest.fn(),
        };
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = view;

        beforeEach(() => {
            ViewManager.getView.mockReturnValue(view);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should pass through the click link to browser history push', () => {
            callsWidgetWindow.handleCallsLinkClick('', {link: '/other/subpath'});
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-1');
            expect(view.sendToRenderer).toBeCalledWith('browser-history-push', '/other/subpath');
        });
    });

    describe('genCallsEventHandler', () => {
        const handler = jest.fn();

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should not call handler if source is not allowed', () => {
            const callsWidgetWindow = new CallsWidgetWindow();
            callsWidgetWindow.isAllowedEvent = () => false;
            callsWidgetWindow.genCallsEventHandler(handler)();
            expect(handler).not.toHaveBeenCalled();
        });

        it('should call handler if source is allowed', () => {
            const callsWidgetWindow = new CallsWidgetWindow();
            callsWidgetWindow.isAllowedEvent = () => true;
            callsWidgetWindow.genCallsEventHandler(handler)();
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleCallsJoinRequest', () => {
        const view = {
            view: {
                server: {
                    id: 'server-1',
                },
            },
            sendToRenderer: jest.fn(),
        };
        const callsWidgetWindow = new CallsWidgetWindow();
        callsWidgetWindow.mainView = view;

        const focus = jest.fn();

        beforeEach(() => {
            MainWindow.get.mockReturnValue({focus});
            ViewManager.getView.mockReturnValue(view);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should pass through the join call callID to the webapp', () => {
            callsWidgetWindow.handleCallsJoinRequest('', {callID: 'thecallchannelid'});
            expect(ServerViewState.switchServer).toHaveBeenCalledWith('server-1');
            expect(focus).toHaveBeenCalled();
            expect(view.sendToRenderer).toBeCalledWith(CALLS_JOIN_REQUEST, {callID: 'thecallchannelid'});
        });
    });
});
