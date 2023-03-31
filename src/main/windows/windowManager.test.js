// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
'use strict';

import {systemPreferences} from 'electron';

import {getTabViewName} from 'common/tabs/TabView';

import ServerManager from 'common/servers/serverManager';
import {getAdjustedWindowBoundaries} from 'main/utils';

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

jest.mock('./callsWidgetWindow', () => ({
    isCallsWidget: jest.fn(),
    getURL: jest.fn(),
}));
jest.mock('common/servers/serverManager', () => ({
    getAllServers: jest.fn(),
    getServer: jest.fn(),
    getCurrentServer: jest.fn(),
    on: jest.fn(),
    lookupTabByURL: jest.fn(),
    getOrderedTabsForServer: jest.fn(),
    getLastActiveTabForServer: jest.fn(),
    getServerLog: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        silly: jest.fn(),
    }),
    getViewLog: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        silly: jest.fn(),
    }),
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

    describe('getServerURLFromWebContentsId', () => {
        const windowManager = new WindowManager();

        it('should return calls widget URL', () => {
            CallsWidgetWindow.getURL.mockReturnValue('http://server-1.com');
            CallsWidgetWindow.isCallsWidget.mockReturnValue(true);
            expect(windowManager.getServerURLFromWebContentsId('callsID')).toBe('http://server-1.com');
        });
    });
});
