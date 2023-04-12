// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
'use strict';

import {systemPreferences} from 'electron';

import Config from 'common/config';
import {getTabViewName} from 'common/tabs/TabView';

import {getAdjustedWindowBoundaries} from 'main/utils';
import LoadingScreen from '../views/loadingScreen';

import ViewManager from 'main/views/viewManager';

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
    show: jest.fn(),
    get: jest.fn(),
}));
jest.mock('./mainWindow', () => ({
    get: jest.fn(),
    focus: jest.fn(),
}));
jest.mock('../downloadsManager', () => ({
    getDownloads: () => {},
}));

jest.mock('./callsWidgetWindow', () => ({
    isCallsWidget: jest.fn(),
    getURL: jest.fn(),
}));
jest.mock('main/views/webContentEvents', () => ({}));

describe('main/windows/windowManager', () => {
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
            ViewManager.getCurrentView.mockReturnValue(view);
            ViewManager.isLoadingScreenHidden.mockReturnValue(true);
            MainWindow.get.mockReturnValue(mainWindow);
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
            ViewManager.getCurrentView.mockReturnValue(view);
            MainWindow.get.mockReturnValue(mainWindow);
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

    describe('getServerURLFromWebContentsId', () => {
        const windowManager = new WindowManager();

        it('should return calls widget URL', () => {
            CallsWidgetWindow.getURL.mockReturnValue('http://server-1.com');
            CallsWidgetWindow.isCallsWidget.mockReturnValue(true);
            expect(windowManager.getServerURLFromWebContentsId('callsID')).toBe('http://server-1.com');
        });
    });
});
