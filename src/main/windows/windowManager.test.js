// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
'use strict';

import {systemPreferences, desktopCapturer} from 'electron';

import {getTabViewName} from 'common/tabs/TabView';

import ServerManager from 'common/servers/serverManager';
import {
    getAdjustedWindowBoundaries,
    resetScreensharePermissionsMacOS,
    openScreensharePermissionsSettingsMacOS,
} from 'main/utils';

import ViewManager from '../views/viewManager';

import {WindowManager} from './windowManager';
import MainWindow from './mainWindow';
import SettingsWindow from './settingsWindow';

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
    reloadConfiguration: jest.fn(),
    showById: jest.fn(),
    getCurrentView: jest.fn(),
    getView: jest.fn(),
    isLoadingScreenHidden: jest.fn(),
    isViewClosed: jest.fn(),
    openClosedTab: jest.fn(),
    setLoadingScreenBounds: jest.fn(),
    handleDeepLink: jest.fn(),
}));
jest.mock('../CriticalErrorHandler', () => jest.fn());
jest.mock('../views/teamDropdownView', () => jest.fn());
jest.mock('../views/downloadsDropdownView', () => jest.fn());
jest.mock('../views/downloadsDropdownMenuView', () => jest.fn());
jest.mock('./settingsWindow', () => ({
    show: jest.fn(),
    get: jest.fn(),
}));
jest.mock('./mainWindow', () => ({
    get: jest.fn(),
}));
jest.mock('../downloadsManager', () => ({
    getDownloads: () => {},
}));

jest.mock('./callsWidgetWindow');
jest.mock('common/servers/serverManager', () => ({
    getAllServers: jest.fn(),
    getServer: jest.fn(),
    getCurrentServer: jest.fn(),
    on: jest.fn(),
    lookupTabByURL: jest.fn(),
    getOrderedTabsForServer: jest.fn(),
    getLastActiveTabForServer: jest.fn(),
}));
jest.mock('main/views/webContentEvents', () => ({}));

describe('main/windows/windowManager', () => {
    describe('showMainWindow', () => {
        const windowManager = new WindowManager();
        windowManager.initializeViewManager = jest.fn();

        const mainWindow = {
            visible: false,
            isVisible: () => mainWindow.visible,
            show: jest.fn().mockImplementation(() => {
                mainWindow.visible = true;
            }),
            focus: jest.fn(),
            on: jest.fn(),
            once: jest.fn(),
            webContents: {
                setWindowOpenHandler: jest.fn(),
            },
        };

        beforeEach(() => {
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
            jest.useFakeTimers();
            MainWindow.get.mockReturnValue(mainWindow);
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
            expect(ViewManager.setLoadingScreenBounds).toHaveBeenCalled();
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
        const mainWindow = {
            getContentBounds: () => ({width: 1000, height: 900}),
            getSize: () => [1000, 900],
        };
        windowManager.teamDropdown = {
            updateWindowBounds: jest.fn(),
        };

        beforeEach(() => {
            MainWindow.get.mockReturnValue(mainWindow);
            ViewManager.getCurrentView.mockReturnValue(view);
            getAdjustedWindowBoundaries.mockImplementation((width, height) => ({width, height}));
        });

        afterEach(() => {
            windowManager.isResizing = false;
            jest.clearAllMocks();
        });

        it('should update loading screen and team dropdown bounds', () => {
            const event = {preventDefault: jest.fn()};
            windowManager.handleWillResizeMainWindow(event, {width: 800, height: 600});
            expect(ViewManager.setLoadingScreenBounds).toHaveBeenCalled();
            expect(windowManager.teamDropdown.updateWindowBounds).toHaveBeenCalled();
        });

        it('should not resize if the app is already resizing', () => {
            windowManager.isResizing = true;
            ViewManager.isLoadingScreenHidden.mockReturnValue(true);
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
            const settingsWindow = {focus: jest.fn()};
            SettingsWindow.get.mockReturnValue(settingsWindow);

            mainWindow.isVisible.mockReturnValue(false);
            mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(settingsWindow.focus).toHaveBeenCalled();
            settingsWindow.focus.mockClear();

            mainWindow.isVisible.mockReturnValue(true);
            mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(settingsWindow.focus).toHaveBeenCalled();
            settingsWindow.focus.mockClear();

            mainWindow.isVisible.mockReturnValue(false);
            mainWindow.isMinimized.mockReturnValue(true);
            windowManager.restoreMain();
            expect(settingsWindow.focus).toHaveBeenCalled();
            settingsWindow.focus.mockClear();

            mainWindow.isVisible.mockReturnValue(true);
            mainWindow.isMinimized.mockReturnValue(true);
            windowManager.restoreMain();
            expect(settingsWindow.focus).toHaveBeenCalled();
            settingsWindow.focus.mockClear();
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
            SettingsWindow.get.mockReturnValue(settingsWindow);

            settingsWindow.isMinimized.mockReturnValue(false);
            windowManager.handleDoubleClick(null, 'settings');
            expect(settingsWindow.minimize).toHaveBeenCalled();

            settingsWindow.isMinimized.mockReturnValue(true);
            windowManager.handleDoubleClick(null, 'settings');
            expect(settingsWindow.restore).toHaveBeenCalled();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('switchServer', () => {
        const windowManager = new WindowManager();
        const views = new Map([
            ['tab-1', {id: 'tab-1'}],
            ['tab-2', {id: 'tab-2'}],
            ['tab-3', {id: 'tab-3'}],
        ]);

        beforeEach(() => {
            jest.useFakeTimers();
            const server1 = {
                id: 'server-1',
            };
            const server2 = {
                id: 'server-2',
            };
            ServerManager.getServer.mockImplementation((name) => {
                switch (name) {
                case 'server-1':
                    return server1;
                case 'server-2':
                    return server2;
                default:
                    return undefined;
                }
            });
            ViewManager.getView.mockImplementation((viewId) => views.get(viewId));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        afterAll(() => {
            jest.runOnlyPendingTimers();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should do nothing if cannot find the server', () => {
            windowManager.switchServer('server-3');
            expect(getTabViewName).not.toBeCalled();
            expect(ViewManager.showById).not.toBeCalled();
        });

        it('should show first open tab in order when last active not defined', () => {
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'tab-3'});
            windowManager.switchServer('server-1');
            expect(ViewManager.showById).toHaveBeenCalledWith('tab-3');
        });

        it('should show last active tab of chosen server', () => {
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'tab-2'});
            windowManager.switchServer('server-2');
            expect(ViewManager.showById).toHaveBeenCalledWith('tab-2');
        });

        it('should wait for view to exist if specified', () => {
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'tab-3'});
            views.delete('tab-3');
            windowManager.switchServer('server-1', true);
            expect(ViewManager.showById).not.toBeCalled();

            jest.advanceTimersByTime(200);
            expect(ViewManager.showById).not.toBeCalled();

            views.set('tab-3', {});
            jest.advanceTimersByTime(200);
            expect(ViewManager.showById).toBeCalledWith('tab-3');
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
            const tabs = [
                {
                    id: 'tab-1',
                    name: 'tab-1',
                    isOpen: false,
                },
                {
                    id: 'tab-2',
                    name: 'tab-2',
                    isOpen: true,
                },
                {
                    id: 'tab-3',
                    name: 'tab-3',
                    isOpen: true,
                },
            ];
            ServerManager.getOrderedTabsForServer.mockReturnValue(tabs);
        });

        afterEach(() => {
            jest.resetAllMocks();
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
            expect(windowManager.switchTab).toBeCalledWith('tab-2');
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
            expect(windowManager.switchTab).toBeCalledWith('tab-3');
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
            expect(windowManager.switchTab).toBeCalledWith('tab-3');
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
            CallsWidgetWindow.mockReturnValue({
                win: {
                    isDestroyed: jest.fn(() => true),
                },
                on: jest.fn(),
                close: jest.fn(),
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
        windowManager.callsWidgetWindow = {
            isAllowedEvent: jest.fn().mockReturnValue(true),
            win: {
                webContents: {
                    send: jest.fn(),
                },
            },
        };
        const teams = [
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
        const map = teams.reduce((arr, item) => {
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

        beforeEach(() => {
            ServerManager.getAllServers.mockReturnValue(teams);
            ViewManager.getView.mockImplementation((viewId) => views.get(viewId));
        });

        afterEach(() => {
            jest.resetAllMocks();
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

            expect(views.get('server-1_tab-1').view.webContents.send).toHaveBeenCalledWith('desktop-sources-result', [
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
            expect(views.get('server-2_tab-1').view.webContents.send).toHaveBeenCalledWith('calls-error', {
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
            expect(views.get('server-1_tab-1').view.webContents.send).toHaveBeenCalledWith('calls-error', {
                err: 'screen-permissions',
            });
            expect(views.get('server-1_tab-1').view.webContents.send).toHaveBeenCalledTimes(1);
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
            expect(views.get('server-1_tab-1').view.webContents.send).toHaveBeenCalledWith('calls-error', {
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
                    getServerId: () => 'server-1',
                    getMainView: jest.fn().mockReturnValue({
                        view: {
                            webContents: {
                                send: jest.fn(),
                            },
                        },
                    }),
                };
            });

            const teams = [
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
            ServerManager.getAllServers.mockReturnValue(teams);

            const map = teams.reduce((arr, item) => {
                item.tabs.forEach((tab) => {
                    arr.push([`${item.name}_${tab.name}`, {}]);
                });
                return arr;
            }, []);
            ViewManager.views = new Map(map);
        });

        afterEach(() => {
            jest.resetAllMocks();
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
                    getServerId: () => 'server-2',
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

            const teams = [
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
            ServerManager.getAllServers.mockReturnValue(teams);

            const map = teams.reduce((arr, item) => {
                item.tabs.forEach((tab) => {
                    arr.push([`${item.name}_${tab.name}`, {}]);
                });
                return arr;
            }, []);
            ViewManager.views = new Map(map);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should switch server', () => {
            windowManager.callsWidgetWindow = new CallsWidgetWindow();
            windowManager.handleCallsWidgetChannelLinkClick();
            expect(windowManager.switchServer).toHaveBeenCalledWith('server-2');
        });
    });

    describe('handleCallsError', () => {
        const windowManager = new WindowManager();
        windowManager.switchServer = jest.fn();
        const mainView = {
            view: {
                webContents: {
                    send: jest.fn(),
                },
            },
        };
        windowManager.callsWidgetWindow = {
            getServerId: () => 'server-2',
            getMainView: () => mainView,
        };
        const focus = jest.fn();

        beforeEach(() => {
            MainWindow.get.mockReturnValue({focus});
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should focus view and propagate error to main view', () => {
            windowManager.handleCallsError('', {err: 'client-error'});
            expect(windowManager.switchServer).toHaveBeenCalledWith('server-2');
            expect(focus).toHaveBeenCalled();
            expect(mainView.view.webContents.send).toHaveBeenCalledWith('calls-error', {err: 'client-error'});
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
                    getServerId: () => 'server-1',
                    getMainView: jest.fn().mockReturnValue(view1),
                };
            });
            ViewManager.getView.mockReturnValue(view1);
        });

        afterEach(() => {
            jest.resetAllMocks();
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
            windowManager.callsWidgetWindow = {
                on: jest.fn(),
                getURL: jest.fn(() => 'http://localhost:8065'),
                getWebContentsId: jest.fn(() => 'callsID'),
            };
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
