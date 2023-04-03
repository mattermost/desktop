// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
'use strict';

import {systemPreferences, desktopCapturer} from 'electron';

import Config from 'common/config';
import {getTabViewName} from 'common/tabs/TabView';

import {
    getAdjustedWindowBoundaries,
    resetScreensharePermissionsMacOS,
    openScreensharePermissionsSettingsMacOS,
} from 'main/utils';
import LoadingScreen from '../views/loadingScreen';

import ViewManager from 'main/views/viewManager';

import {WindowManager} from './windowManager';
import MainWindow from './mainWindow';
import {createSettingsWindow} from './settingsWindow';
import CallsWidgetWindow from './callsWidgetWindow';

jest.mock('path', () => ({
    resolve: jest.fn(),
    join: jest.fn(),
}));

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
    },
    app: {
        getAppPath: jest.fn(),
        quit: jest.fn(),
        dock: {
            show: jest.fn(),
            bounce: jest.fn(),
        },
    },
    systemPreferences: {
        getUserDefault: jest.fn(),
        getMediaAccessStatus: jest.fn(() => 'granted'),
    },
    desktopCapturer: {
        getSources: jest.fn(),
    },
}));

jest.mock('common/config', () => ({}));

jest.mock('common/tabs/TabView', () => ({
    getTabViewName: jest.fn(),
    TAB_MESSAGING: 'tab-messaging',
}));
jest.mock('../utils', () => ({
    getAdjustedWindowBoundaries: jest.fn(),
    shouldHaveBackBar: jest.fn(),
    openScreensharePermissionsSettingsMacOS: jest.fn(),
    resetScreensharePermissionsMacOS: jest.fn(),
}));
jest.mock('../views/viewManager', () => ({
    isLoadingScreenHidden: jest.fn(),
    getView: jest.fn(),
    getViewByWebContentsId: jest.fn(),
    getCurrentView: jest.fn(),
    isViewClosed: jest.fn(),
    openClosedTab: jest.fn(),
    handleDeepLink: jest.fn(),
    setLoadingScreenBounds: jest.fn(),
    showByName: jest.fn(),
    updateMainWindow: jest.fn(),
}));
jest.mock('../CriticalErrorHandler', () => jest.fn());
jest.mock('../views/loadingScreen', () => ({
    isHidden: jest.fn(),
    setBounds: jest.fn(),
}));
jest.mock('../views/teamDropdownView', () => jest.fn());
jest.mock('../views/downloadsDropdownView', () => jest.fn());
jest.mock('../views/downloadsDropdownMenuView', () => jest.fn());
jest.mock('./settingsWindow', () => ({
    createSettingsWindow: jest.fn(),
}));
jest.mock('./mainWindow', () => ({
    get: jest.fn(),
    focus: jest.fn(),
}));
jest.mock('../downloadsManager', () => ({
    getDownloads: () => {},
}));

jest.mock('./callsWidgetWindow');
jest.mock('main/views/webContentEvents', () => ({}));

describe('main/windows/windowManager', () => {
    describe('showSettingsWindow', () => {
        const windowManager = new WindowManager();
        windowManager.showMainWindow = jest.fn();

        afterEach(() => {
            jest.resetAllMocks();
            delete windowManager.settingsWindow;
            delete windowManager.mainWindow;
        });

        it('should show settings window if it exists', () => {
            const settingsWindow = {show: jest.fn()};
            windowManager.settingsWindow = settingsWindow;
            windowManager.showSettingsWindow();
            expect(settingsWindow.show).toHaveBeenCalled();
        });

        it('should create windows if they dont exist and delete the settings window when it is closed', () => {
            let callback;
            createSettingsWindow.mockReturnValue({on: (event, cb) => {
                if (event === 'closed') {
                    callback = cb;
                }
            }});
            windowManager.showSettingsWindow();
            expect(windowManager.showMainWindow).toHaveBeenCalled();
            expect(createSettingsWindow).toHaveBeenCalled();
            expect(windowManager.settingsWindow).toBeDefined();

            callback();
            expect(windowManager.settingsWindow).toBeUndefined();
        });
    });

    describe('showMainWindow', () => {
        const windowManager = new WindowManager();
        windowManager.initializeViewManager = jest.fn();

        const mainWindow = {
            visible: false,
            isVisible: () => mainWindow.visible,
            show: jest.fn(),
            focus: jest.fn(),
            on: jest.fn(),
            once: jest.fn(),
            webContents: {
                setWindowOpenHandler: jest.fn(),
            },
        };

        beforeEach(() => {
            mainWindow.show.mockImplementation(() => {
                mainWindow.visible = true;
            });
            MainWindow.get.mockReturnValue(mainWindow);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should show main window if it exists and focus it if it is already visible', () => {
            windowManager.showMainWindow();
            expect(mainWindow.show).toHaveBeenCalled();

            windowManager.showMainWindow();
            expect(mainWindow.focus).toHaveBeenCalled();
        });

        it('should open deep link when provided', () => {
            windowManager.showMainWindow('mattermost://server-1.com/subpath');
            expect(ViewManager.handleDeepLink).toHaveBeenCalledWith('mattermost://server-1.com/subpath');
        });
    });

    describe('handleResizeMainWindow', () => {
        const windowManager = new WindowManager();
        const view = {
            setBounds: jest.fn(),
            tab: {
                url: 'http://server-1.com',
            },
            view: {
                webContents: {
                    getURL: jest.fn(),
                },
            },
        };
        const mainWindow = {
            getContentBounds: () => ({width: 800, height: 600}),
            getSize: () => [1000, 900],
        };
        windowManager.teamDropdown = {
            updateWindowBounds: jest.fn(),
        };

        beforeEach(() => {
            MainWindow.get.mockReturnValue(mainWindow);
            jest.useFakeTimers();
            ViewManager.getCurrentView.mockReturnValue(view);
            getAdjustedWindowBoundaries.mockImplementation((width, height) => ({width, height}));
        });

        afterEach(() => {
            jest.runAllTimers();
            jest.resetAllMocks();
            jest.runOnlyPendingTimers();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should update loading screen and team dropdown bounds', () => {
            windowManager.handleResizeMainWindow();
            expect(LoadingScreen.setBounds).toHaveBeenCalled();
            expect(windowManager.teamDropdown.updateWindowBounds).toHaveBeenCalled();
        });

        it('should use getSize when the platform is linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });

            windowManager.handleResizeMainWindow();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });

            expect(view.setBounds).not.toHaveBeenCalled();
            jest.runAllTimers();
            expect(view.setBounds).toHaveBeenCalledWith({width: 1000, height: 900});
        });
    });

    describe('handleWillResizeMainWindow', () => {
        const windowManager = new WindowManager();
        const view = {
            setBounds: jest.fn(),
            tab: {
                url: 'http://server-1.com',
            },
            view: {
                webContents: {
                    getURL: jest.fn(),
                },
            },
        };
        windowManager.teamDropdown = {
            updateWindowBounds: jest.fn(),
        };
        const mainWindow = {
            getContentBounds: () => ({width: 1000, height: 900}),
            getSize: () => [1000, 900],
        };

        beforeEach(() => {
            MainWindow.get.mockReturnValue(mainWindow);
            ViewManager.getCurrentView.mockReturnValue(view);
            LoadingScreen.isHidden.mockReturnValue(true);
            getAdjustedWindowBoundaries.mockImplementation((width, height) => ({width, height}));
        });

        afterEach(() => {
            windowManager.isResizing = false;
            jest.clearAllMocks();
        });

        it('should update loading screen and team dropdown bounds', () => {
            const event = {preventDefault: jest.fn()};
            windowManager.handleWillResizeMainWindow(event, {width: 800, height: 600});
            expect(LoadingScreen.setBounds).toHaveBeenCalled();
            expect(windowManager.teamDropdown.updateWindowBounds).toHaveBeenCalled();
        });

        it('should not resize if the app is already resizing', () => {
            windowManager.isResizing = true;
            LoadingScreen.isHidden.mockReturnValue(true);
            const event = {preventDefault: jest.fn()};
            windowManager.handleWillResizeMainWindow(event, {width: 800, height: 600});
            expect(event.preventDefault).toHaveBeenCalled();
            expect(view.setBounds).not.toHaveBeenCalled();
        });

        it('should use provided bounds', () => {
            const event = {preventDefault: jest.fn()};
            windowManager.handleWillResizeMainWindow(event, {width: 800, height: 600});
            expect(windowManager.isResizing).toBe(true);
            expect(view.setBounds).toHaveBeenCalledWith({width: 800, height: 600});
        });
    });

    describe('handleResizedMainWindow', () => {
        const windowManager = new WindowManager();
        const view = {
            setBounds: jest.fn(),
            tab: {
                url: 'http://server-1.com',
            },
            view: {
                webContents: {
                    getURL: jest.fn(),
                },
            },
        };
        const mainWindow = {
            getContentBounds: () => ({width: 800, height: 600}),
            getSize: () => [1000, 900],
        };

        beforeEach(() => {
            MainWindow.get.mockReturnValue(mainWindow);
            ViewManager.getCurrentView.mockReturnValue(view);
            getAdjustedWindowBoundaries.mockImplementation((width, height) => ({width, height}));
        });

        afterEach(() => {
            windowManager.isResizing = true;
            jest.resetAllMocks();
        });

        it('should use getContentBounds when the platform is different to linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'windows',
            });

            windowManager.handleResizedMainWindow();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });

            expect(windowManager.isResizing).toBe(false);
            expect(view.setBounds).toHaveBeenCalledWith({width: 800, height: 600});
        });

        it('should use getSize when the platform is linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });

            windowManager.handleResizedMainWindow();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });

            expect(windowManager.isResizing).toBe(false);
            expect(view.setBounds).toHaveBeenCalledWith({width: 1000, height: 900});
        });
    });

    describe('restoreMain', () => {
        const windowManager = new WindowManager();
        const mainWindow = {
            isVisible: jest.fn(),
            isMinimized: jest.fn(),
            restore: jest.fn(),
            show: jest.fn(),
            focus: jest.fn(),
        };

        beforeEach(() => {
            MainWindow.get.mockReturnValue(mainWindow);
        });

        afterEach(() => {
            jest.resetAllMocks();
            delete windowManager.settingsWindow;
        });

        it('should restore main window if minimized', () => {
            mainWindow.isMinimized.mockReturnValue(true);
            windowManager.restoreMain();
            expect(mainWindow.restore).toHaveBeenCalled();
        });

        it('should show main window if not visible or minimized', () => {
            mainWindow.isVisible.mockReturnValue(false);
            mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(mainWindow.show).toHaveBeenCalled();
        });

        it('should focus main window if visible and not minimized', () => {
            mainWindow.isVisible.mockReturnValue(true);
            mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(mainWindow.focus).toHaveBeenCalled();
        });

        it('should focus settings window regardless of main window state if it exists', () => {
            windowManager.settingsWindow = {
                focus: jest.fn(),
            };

            mainWindow.isVisible.mockReturnValue(false);
            mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(windowManager.settingsWindow.focus).toHaveBeenCalled();
            windowManager.settingsWindow.focus.mockClear();

            mainWindow.isVisible.mockReturnValue(true);
            mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(windowManager.settingsWindow.focus).toHaveBeenCalled();
            windowManager.settingsWindow.focus.mockClear();

            mainWindow.isVisible.mockReturnValue(false);
            mainWindow.isMinimized.mockReturnValue(true);
            windowManager.restoreMain();
            expect(windowManager.settingsWindow.focus).toHaveBeenCalled();
            windowManager.settingsWindow.focus.mockClear();

            mainWindow.isVisible.mockReturnValue(true);
            mainWindow.isMinimized.mockReturnValue(true);
            windowManager.restoreMain();
            expect(windowManager.settingsWindow.focus).toHaveBeenCalled();
            windowManager.settingsWindow.focus.mockClear();
        });
    });

    describe('handleDoubleClick', () => {
        const windowManager = new WindowManager();
        const mainWindow = {
            isMinimized: jest.fn(),
            restore: jest.fn(),
            minimize: jest.fn(),
            isMaximized: jest.fn(),
            unmaximize: jest.fn(),
            maximize: jest.fn(),
        };
        const settingsWindow = {
            isMinimized: jest.fn(),
            restore: jest.fn(),
            minimize: jest.fn(),
            isMaximized: jest.fn(),
            unmaximize: jest.fn(),
            maximize: jest.fn(),
        };

        beforeEach(() => {
            systemPreferences.getUserDefault.mockReturnValue('Maximize');
        });

        afterEach(() => {
            jest.resetAllMocks();
            delete windowManager.mainWindow;
            delete windowManager.settingsWindow;
        });

        it('should do nothing when the windows arent set', () => {
            windowManager.handleDoubleClick(null, 'settings');
            expect(settingsWindow.isMaximized).not.toHaveBeenCalled();

            windowManager.handleDoubleClick();
            expect(mainWindow.isMaximized).not.toHaveBeenCalled();
        });

        it('should maximize when not maximized and vice versa', () => {
            MainWindow.get.mockReturnValue(mainWindow);

            mainWindow.isMaximized.mockReturnValue(false);
            windowManager.handleDoubleClick();
            expect(mainWindow.maximize).toHaveBeenCalled();

            mainWindow.isMaximized.mockReturnValue(true);
            windowManager.handleDoubleClick();
            expect(mainWindow.unmaximize).toHaveBeenCalled();
        });

        it('mac - should minimize when not minimized and vice versa when setting is set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            systemPreferences.getUserDefault.mockReturnValue('Minimize');
            windowManager.settingsWindow = settingsWindow;

            windowManager.settingsWindow.isMinimized.mockReturnValue(false);
            windowManager.handleDoubleClick(null, 'settings');
            expect(settingsWindow.minimize).toHaveBeenCalled();

            windowManager.settingsWindow.isMinimized.mockReturnValue(true);
            windowManager.handleDoubleClick(null, 'settings');
            expect(settingsWindow.restore).toHaveBeenCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('switchServer', () => {
        const windowManager = new WindowManager();
        const servers = [
            {
                name: 'server-1',
                order: 1,
                tabs: [
                    {
                        name: 'tab-1',
                        order: 0,
                        isOpen: false,
                    },
                    {
                        name: 'tab-2',
                        order: 2,
                        isOpen: true,
                    },
                    {
                        name: 'tab-3',
                        order: 1,
                        isOpen: true,
                    },
                ],
            }, {
                name: 'server-2',
                order: 0,
                tabs: [
                    {
                        name: 'tab-1',
                        order: 0,
                        isOpen: false,
                    },
                    {
                        name: 'tab-2',
                        order: 2,
                        isOpen: true,
                    },
                    {
                        name: 'tab-3',
                        order: 1,
                        isOpen: true,
                    },
                ],
                lastActiveTab: 2,
            },
        ];
        const map = servers.reduce((arr, item) => {
            item.tabs.forEach((tab) => {
                arr.push([`${item.name}_${tab.name}`, {}]);
            });
            return arr;
        }, []);
        const views = new Map(map);

        beforeEach(() => {
            jest.useFakeTimers();
            getTabViewName.mockImplementation((server, tab) => `${server}_${tab}`);
            Config.teams = servers.concat();
            ViewManager.getView.mockImplementation((name) => views.get(name));
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
        });

        afterAll(() => {
            jest.runOnlyPendingTimers();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should do nothing if cannot find the server', () => {
            windowManager.switchServer('server-3');
            expect(getTabViewName).not.toBeCalled();
            expect(ViewManager.showByName).not.toBeCalled();
        });

        it('should show first open tab in order when last active not defined', () => {
            windowManager.switchServer('server-1');
            expect(ViewManager.showByName).toHaveBeenCalledWith('server-1_tab-3');
        });

        it('should show last active tab of chosen server', () => {
            windowManager.switchServer('server-2');
            expect(ViewManager.showByName).toHaveBeenCalledWith('server-2_tab-2');
        });

        it('should wait for view to exist if specified', () => {
            views.delete('server-1_tab-3');
            windowManager.switchServer('server-1', true);
            expect(ViewManager.showByName).not.toBeCalled();

            jest.advanceTimersByTime(200);
            expect(ViewManager.showByName).not.toBeCalled();

            views.set('server-1_tab-3', {});
            jest.advanceTimersByTime(200);
            expect(ViewManager.showByName).toBeCalledWith('server-1_tab-3');
        });
    });

    describe('handleHistory', () => {
        const windowManager = new WindowManager();

        it('should only go to offset if it can', () => {
            const view = {
                view: {
                    webContents: {
                        goToOffset: jest.fn(),
                        canGoToOffset: () => false,
                    },
                },
            };
            ViewManager.getCurrentView.mockReturnValue(view);

            windowManager.handleHistory(null, 1);
            expect(view.view.webContents.goToOffset).not.toBeCalled();

            ViewManager.getCurrentView.mockReturnValue({
                ...view,
                view: {
                    ...view.view,
                    webContents: {
                        ...view.view.webContents,
                        canGoToOffset: () => true,
                    },
                },
            });

            windowManager.handleHistory(null, 1);
            expect(view.view.webContents.goToOffset).toBeCalled();
        });

        it('should load base URL if an error occurs', () => {
            const view = {
                load: jest.fn(),
                tab: {
                    url: 'http://server-1.com',
                },
                view: {
                    webContents: {
                        goToOffset: jest.fn(),
                        canGoToOffset: () => true,
                    },
                },
            };
            view.view.webContents.goToOffset.mockImplementation(() => {
                throw new Error('hi');
            });
            ViewManager.getCurrentView.mockReturnValue(view);

            windowManager.handleHistory(null, 1);
            expect(view.load).toBeCalledWith('http://server-1.com');
        });
    });

    describe('selectTab', () => {
        const windowManager = new WindowManager();
        windowManager.switchTab = jest.fn();

        beforeEach(() => {
            Config.teams = [
                {
                    name: 'server-1',
                    order: 1,
                    tabs: [
                        {
                            name: 'tab-1',
                            order: 0,
                            isOpen: false,
                        },
                        {
                            name: 'tab-2',
                            order: 2,
                            isOpen: true,
                        },
                        {
                            name: 'tab-3',
                            order: 1,
                            isOpen: true,
                        },
                    ],
                },
            ];
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
        });

        it('should select next server when open', () => {
            ViewManager.getCurrentView.mockReturnValue({
                tab: {
                    server: {
                        name: 'server-1',
                    },
                    type: 'tab-3',
                },
            });

            windowManager.selectTab((order) => order + 1);
            expect(windowManager.switchTab).toBeCalledWith('server-1', 'tab-2');
        });

        it('should select previous server when open', () => {
            ViewManager.getCurrentView.mockReturnValue({
                tab: {
                    server: {
                        name: 'server-1',
                    },
                    type: 'tab-2',
                },
            });

            windowManager.selectTab((order, length) => (length + (order - 1)));
            expect(windowManager.switchTab).toBeCalledWith('server-1', 'tab-3');
        });

        it('should skip over closed tab', () => {
            ViewManager.getCurrentView.mockReturnValue({
                tab: {
                    server: {
                        name: 'server-1',
                    },
                    type: 'tab-2',
                },
            });
            windowManager.selectTab((order) => order + 1);
            expect(windowManager.switchTab).toBeCalledWith('server-1', 'tab-3');
        });
    });

    describe('createCallsWidgetWindow', () => {
        const windowManager = new WindowManager();
        const view = {
            name: 'server-1_tab-messaging',
            serverInfo: {
                server: {
                    url: new URL('http://server-1.com'),
                },
            },
        };

        beforeEach(() => {
            CallsWidgetWindow.mockImplementation(() => {
                return {
                    win: {
                        isDestroyed: jest.fn(() => true),
                    },
                    on: jest.fn(),
                    close: jest.fn(),
                };
            });
            ViewManager.getView.mockReturnValue(view);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should create calls widget window', async () => {
            expect(windowManager.callsWidgetWindow).toBeUndefined();
            await windowManager.createCallsWidgetWindow('server-1_tab-messaging', {callID: 'test'});
            expect(windowManager.callsWidgetWindow).toBeDefined();
        });

        it('should not create a new window if call is the same', async () => {
            const widgetWindow = windowManager.callsWidgetWindow;
            expect(widgetWindow).toBeDefined();
            widgetWindow.getCallID = jest.fn(() => 'test');
            await windowManager.createCallsWidgetWindow('server-1_tab-messaging', {callID: 'test'});
            expect(windowManager.callsWidgetWindow).toEqual(widgetWindow);
        });

        it('should create a new window if switching calls', async () => {
            const widgetWindow = windowManager.callsWidgetWindow;
            expect(widgetWindow).toBeDefined();
            widgetWindow.getCallID = jest.fn(() => 'test');
            await windowManager.createCallsWidgetWindow('server-1_tab-messaging', {callID: 'test2'});
            expect(windowManager.callsWidgetWindow).not.toEqual(widgetWindow);
        });
    });

    describe('handleGetDesktopSources', () => {
        const windowManager = new WindowManager();

        beforeEach(() => {
            CallsWidgetWindow.mockImplementation(() => {
                return {
                    isAllowedEvent: jest.fn().mockReturnValue(true),
                    win: {
                        webContents: {
                            send: jest.fn(),
                        },
                    },
                };
            });

            windowManager.callsWidgetWindow = new CallsWidgetWindow();

            Config.teams = [
                {
                    name: 'server-1',
                    order: 1,
                    tabs: [
                        {
                            name: 'tab-1',
                            order: 0,
                            isOpen: false,
                        },
                        {
                            name: 'tab-2',
                            order: 2,
                            isOpen: true,
                        },
                    ],
                }, {
                    name: 'server-2',
                    order: 0,
                    tabs: [
                        {
                            name: 'tab-1',
                            order: 0,
                            isOpen: false,
                        },
                        {
                            name: 'tab-2',
                            order: 2,
                            isOpen: true,
                        },
                    ],
                    lastActiveTab: 2,
                },
            ];

            const map = Config.teams.reduce((arr, item) => {
                item.tabs.forEach((tab) => {
                    arr.push([`${item.name}_${tab.name}`, {
                        view: {
                            webContents: {
                                send: jest.fn(),
                            },
                        },
                    }]);
                });
                return arr;
            }, []);
            const views = new Map(map);
            ViewManager.getView.mockImplementation((name) => views.get(name));
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
            windowManager.missingScreensharePermissions = undefined;
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

            await windowManager.handleGetDesktopSources('server-1_tab-1', null);

            expect(ViewManager.getView('server-1_tab-1').view.webContents.send).toHaveBeenCalledWith('desktop-sources-result', [
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
            await windowManager.handleGetDesktopSources('server-2_tab-1', null);
            expect(windowManager.callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(ViewManager.getView('server-2_tab-1').view.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(windowManager.callsWidgetWindow.win.webContents.send).toHaveBeenCalledTimes(1);
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

            await windowManager.handleGetDesktopSources('server-1_tab-1', null);

            expect(systemPreferences.getMediaAccessStatus).toHaveBeenCalledWith('screen');
            expect(windowManager.callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(ViewManager.getView('server-1_tab-1').view.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(ViewManager.getView('server-1_tab-1').view.webContents.send).toHaveBeenCalledTimes(1);
            expect(windowManager.callsWidgetWindow.win.webContents.send).toHaveBeenCalledTimes(1);
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

            await windowManager.handleGetDesktopSources('server-1_tab-1', null);

            expect(windowManager.missingScreensharePermissions).toBe(true);
            expect(resetScreensharePermissionsMacOS).toHaveBeenCalledTimes(1);
            expect(openScreensharePermissionsSettingsMacOS).toHaveBeenCalledTimes(0);
            expect(windowManager.callsWidgetWindow.win.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(ViewManager.getView('server-1_tab-1').view.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });

            await windowManager.handleGetDesktopSources('server-1_tab-1', null);

            expect(resetScreensharePermissionsMacOS).toHaveBeenCalledTimes(2);
            expect(openScreensharePermissionsSettingsMacOS).toHaveBeenCalledTimes(1);

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('handleDesktopSourcesModalRequest', () => {
        const windowManager = new WindowManager();
        windowManager.switchServer = jest.fn();

        beforeEach(() => {
            CallsWidgetWindow.mockImplementation(() => {
                return {
                    getServerName: () => 'server-1',
                    getMainView: jest.fn().mockReturnValue({
                        view: {
                            webContents: {
                                send: jest.fn(),
                            },
                        },
                    }),
                };
            });

            Config.teams = [
                {
                    name: 'server-1',
                    order: 1,
                    tabs: [
                        {
                            name: 'tab-1',
                            order: 0,
                            isOpen: false,
                        },
                        {
                            name: 'tab-2',
                            order: 2,
                            isOpen: true,
                        },
                    ],
                }, {
                    name: 'server-2',
                    order: 0,
                    tabs: [
                        {
                            name: 'tab-1',
                            order: 0,
                            isOpen: false,
                        },
                        {
                            name: 'tab-2',
                            order: 2,
                            isOpen: true,
                        },
                    ],
                    lastActiveTab: 2,
                },
            ];

            const map = Config.teams.reduce((arr, item) => {
                item.tabs.forEach((tab) => {
                    arr.push([`${item.name}_${tab.name}`, {}]);
                });
                return arr;
            }, []);
            const views = new Map(map);
            ViewManager.getView.mockImplementation((name) => views.get(name));
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
        });

        it('should switch server', () => {
            windowManager.callsWidgetWindow = new CallsWidgetWindow();
            windowManager.handleDesktopSourcesModalRequest();
            expect(windowManager.switchServer).toHaveBeenCalledWith('server-1');
        });
    });

    describe('handleCallsWidgetChannelLinkClick', () => {
        const windowManager = new WindowManager();
        windowManager.switchServer = jest.fn();

        beforeEach(() => {
            CallsWidgetWindow.mockImplementation(() => {
                return {
                    getServerName: () => 'server-2',
                    getMainView: jest.fn().mockReturnValue({
                        view: {
                            webContents: {
                                send: jest.fn(),
                            },
                        },
                    }),
                    getChannelURL: jest.fn(),
                };
            });

            Config.teams = [
                {
                    name: 'server-1',
                    order: 1,
                    tabs: [
                        {
                            name: 'tab-1',
                            order: 0,
                            isOpen: false,
                        },
                        {
                            name: 'tab-2',
                            order: 2,
                            isOpen: true,
                        },
                    ],
                }, {
                    name: 'server-2',
                    order: 0,
                    tabs: [
                        {
                            name: 'tab-1',
                            order: 0,
                            isOpen: false,
                        },
                        {
                            name: 'tab-2',
                            order: 2,
                            isOpen: true,
                        },
                    ],
                    lastActiveTab: 2,
                },
            ];

            const map = Config.teams.reduce((arr, item) => {
                item.tabs.forEach((tab) => {
                    arr.push([`${item.name}_${tab.name}`, {}]);
                });
                return arr;
            }, []);
            const views = new Map(map);
            ViewManager.getView.mockImplementation((name) => views.get(name));
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
        });

        it('should switch server', () => {
            windowManager.callsWidgetWindow = new CallsWidgetWindow();
            windowManager.handleCallsWidgetChannelLinkClick();
            expect(windowManager.switchServer).toHaveBeenCalledWith('server-2');
        });
    });

    describe('handleCallsError', () => {
        const windowManager = new WindowManager();
        const mainWindow = {
            focus: jest.fn(),
        };
        windowManager.switchServer = jest.fn();

        beforeEach(() => {
            CallsWidgetWindow.mockImplementation(() => {
                return {
                    getServerName: () => 'server-2',
                    getMainView: jest.fn().mockReturnValue({
                        view: {
                            webContents: {
                                send: jest.fn(),
                            },
                        },
                    }),
                };
            });
            MainWindow.get.mockReturnValue(mainWindow);
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
        });

        it('should focus view and propagate error to main view', () => {
            windowManager.callsWidgetWindow = new CallsWidgetWindow();
            windowManager.handleCallsError('', {err: 'client-error'});
            expect(windowManager.switchServer).toHaveBeenCalledWith('server-2');
            expect(mainWindow.focus).toHaveBeenCalled();
            expect(windowManager.callsWidgetWindow.getMainView().view.webContents.send).toHaveBeenCalledWith('calls-error', {err: 'client-error'});
        });
    });

    describe('handleCallsLinkClick', () => {
        const windowManager = new WindowManager();
        windowManager.switchServer = jest.fn();
        const view1 = {
            view: {
                webContents: {
                    send: jest.fn(),
                },
            },
        };

        beforeEach(() => {
            CallsWidgetWindow.mockImplementation(() => {
                return {
                    getServerName: () => 'server-1',
                    getMainView: jest.fn().mockReturnValue(view1),
                };
            });
            ViewManager.getView.mockReturnValue(view1);
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
        });

        it('should pass through the click link to browser history push', () => {
            windowManager.callsWidgetWindow = new CallsWidgetWindow();
            windowManager.handleCallsLinkClick('', {link: '/other/subpath'});
            expect(windowManager.switchServer).toHaveBeenCalledWith('server-1');
            expect(view1.view.webContents.send).toBeCalledWith('browser-history-push', '/other/subpath');
        });
    });

    describe('getServerURLFromWebContentsId', () => {
        const windowManager = new WindowManager();

        it('should return calls widget URL', () => {
            ViewManager.getView.mockReturnValue({name: 'server-1_tab-messaging'});
            CallsWidgetWindow.mockImplementation(() => {
                return {
                    on: jest.fn(),
                    getURL: jest.fn(() => 'http://localhost:8065'),
                    getWebContentsId: jest.fn(() => 'callsID'),
                };
            });

            windowManager.createCallsWidgetWindow('server-1_tab-messaging', 'http://localhost:8065', {callID: 'test'});
            expect(windowManager.getServerURLFromWebContentsId('callsID')).toBe(windowManager.callsWidgetWindow.getURL());
        });
    });

    describe('genCallsEventHandler', () => {
        const windowManager = new WindowManager();

        const handler = jest.fn();

        it('should call handler if callsWidgetWindow is not defined', () => {
            windowManager.genCallsEventHandler(handler)();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should not call handler if source is not allowed', () => {
            CallsWidgetWindow.mockImplementation(() => {
                return {
                    isAllowedEvent: jest.fn().mockReturnValue(false),
                };
            });

            windowManager.callsWidgetWindow = new CallsWidgetWindow();
            windowManager.genCallsEventHandler(handler)();
            expect(handler).not.toHaveBeenCalled();
        });

        it('should call handler if source is allowed', () => {
            CallsWidgetWindow.mockImplementation(() => {
                return {
                    isAllowedEvent: jest.fn().mockReturnValue(true),
                };
            });

            windowManager.callsWidgetWindow = new CallsWidgetWindow();
            windowManager.genCallsEventHandler(handler)();
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });
});
