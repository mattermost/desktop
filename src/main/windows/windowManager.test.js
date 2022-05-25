// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
'use strict';

import {app, systemPreferences} from 'electron';

import Config from 'common/config';
import {getTabViewName, TAB_MESSAGING} from 'common/tabs/TabView';
import urlUtils from 'common/utils/url';

import {getAdjustedWindowBoundaries} from 'main/utils';

import {WindowManager} from './windowManager';
import createMainWindow from './mainWindow';
import {createSettingsWindow} from './settingsWindow';

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

jest.mock('common/utils/url', () => ({
    isTeamUrl: jest.fn(),
    isAdminUrl: jest.fn(),
    getView: jest.fn(),
    cleanPathName: jest.fn(),
}));
jest.mock('common/tabs/TabView', () => ({
    getTabViewName: jest.fn(),
    TAB_MESSAGING: 'tab-messaging',
}));
jest.mock('../utils', () => ({
    getAdjustedWindowBoundaries: jest.fn(),
    shouldHaveBackBar: jest.fn(),
}));
jest.mock('../views/viewManager', () => ({
    ViewManager: jest.fn(),
}));
jest.mock('../CriticalErrorHandler', () => jest.fn());
jest.mock('../views/teamDropdownView', () => jest.fn());
jest.mock('./settingsWindow', () => ({
    createSettingsWindow: jest.fn(),
}));
jest.mock('./mainWindow', () => jest.fn());

describe('main/windows/windowManager', () => {
    describe('handleUpdateConfig', () => {
        const windowManager = new WindowManager();

        beforeEach(() => {
            windowManager.viewManager = {
                reloadConfiguration: jest.fn(),
            };
        });

        it('should reload config', () => {
            windowManager.handleUpdateConfig();
            expect(windowManager.viewManager.reloadConfiguration).toHaveBeenCalled();
        });
    });

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
        windowManager.viewManager = {
            handleDeepLink: jest.fn(),
            updateMainWindow: jest.fn(),
        };
        windowManager.initializeViewManager = jest.fn();

        afterEach(() => {
            delete windowManager.mainWindow;
        });

        it('should show main window if it exists and focus it if it is already visible', () => {
            windowManager.mainWindow = {
                visible: false,
                isVisible: () => windowManager.mainWindow.visible,
                show: jest.fn().mockImplementation(() => {
                    windowManager.mainWindow.visible = true;
                }),
                focus: jest.fn(),
            };

            windowManager.showMainWindow();
            expect(windowManager.mainWindow.show).toHaveBeenCalled();

            windowManager.showMainWindow();
            expect(windowManager.mainWindow.focus).toHaveBeenCalled();
        });

        it('should quit the app when the main window fails to create', () => {
            windowManager.showMainWindow();
            expect(app.quit).toHaveBeenCalled();
        });

        it('should create the main window and add listeners', () => {
            const window = {
                on: jest.fn(),
                once: jest.fn(),
            };
            createMainWindow.mockReturnValue(window);
            windowManager.showMainWindow();
            expect(windowManager.mainWindow).toBe(window);
            expect(window.on).toHaveBeenCalled();
        });

        it('should open deep link when provided', () => {
            const window = {
                on: jest.fn(),
                once: jest.fn(),
            };
            createMainWindow.mockReturnValue(window);
            windowManager.showMainWindow('mattermost://server-1.com/subpath');
            expect(windowManager.viewManager.handleDeepLink).toHaveBeenCalledWith('mattermost://server-1.com/subpath');
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
        windowManager.viewManager = {
            getCurrentView: () => view,
            setLoadingScreenBounds: jest.fn(),
        };
        windowManager.mainWindow = {
            getContentBounds: () => ({width: 800, height: 600}),
            getSize: () => [1000, 900],
        };
        windowManager.teamDropdown = {
            updateWindowBounds: jest.fn(),
        };

        beforeEach(() => {
            jest.useFakeTimers();
            getAdjustedWindowBoundaries.mockImplementation((width, height) => ({width, height}));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should update loading screen and team dropdown bounds', () => {
            windowManager.handleResizeMainWindow();
            expect(windowManager.viewManager.setLoadingScreenBounds).toHaveBeenCalled();
            expect(windowManager.teamDropdown.updateWindowBounds).toHaveBeenCalled();
        });

        it('should use getContentBounds when the platform is not linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            windowManager.handleResizeMainWindow();
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(view.setBounds).toHaveBeenCalledWith({width: 800, height: 600});
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

    describe('restoreMain', () => {
        const windowManager = new WindowManager();
        windowManager.mainWindow = {
            isVisible: jest.fn(),
            isMinimized: jest.fn(),
            restore: jest.fn(),
            show: jest.fn(),
            focus: jest.fn(),
        };

        afterEach(() => {
            jest.resetAllMocks();
            delete windowManager.settingsWindow;
        });

        it('should restore main window if minimized', () => {
            windowManager.mainWindow.isMinimized.mockReturnValue(true);
            windowManager.restoreMain();
            expect(windowManager.mainWindow.restore).toHaveBeenCalled();
        });

        it('should show main window if not visible or minimized', () => {
            windowManager.mainWindow.isVisible.mockReturnValue(false);
            windowManager.mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(windowManager.mainWindow.show).toHaveBeenCalled();
        });

        it('should focus main window if visible and not minimized', () => {
            windowManager.mainWindow.isVisible.mockReturnValue(true);
            windowManager.mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(windowManager.mainWindow.focus).toHaveBeenCalled();
        });

        it('should focus settings window regardless of main window state if it exists', () => {
            windowManager.settingsWindow = {
                focus: jest.fn(),
            };

            windowManager.mainWindow.isVisible.mockReturnValue(false);
            windowManager.mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(windowManager.settingsWindow.focus).toHaveBeenCalled();
            windowManager.settingsWindow.focus.mockClear();

            windowManager.mainWindow.isVisible.mockReturnValue(true);
            windowManager.mainWindow.isMinimized.mockReturnValue(false);
            windowManager.restoreMain();
            expect(windowManager.settingsWindow.focus).toHaveBeenCalled();
            windowManager.settingsWindow.focus.mockClear();

            windowManager.mainWindow.isVisible.mockReturnValue(false);
            windowManager.mainWindow.isMinimized.mockReturnValue(true);
            windowManager.restoreMain();
            expect(windowManager.settingsWindow.focus).toHaveBeenCalled();
            windowManager.settingsWindow.focus.mockClear();

            windowManager.mainWindow.isVisible.mockReturnValue(true);
            windowManager.mainWindow.isMinimized.mockReturnValue(true);
            windowManager.restoreMain();
            expect(windowManager.settingsWindow.focus).toHaveBeenCalled();
            windowManager.settingsWindow.focus.mockClear();
        });
    });

    describe('flashFrame', () => {
        const windowManager = new WindowManager();
        windowManager.mainWindow = {
            flashFrame: jest.fn(),
        };
        windowManager.settingsWindow = {
            flashFrame: jest.fn(),
        };

        beforeEach(() => {
            Config.notifications = {};
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.notifications = {};
        });

        it('linux/windows - should not flash frame when config item is not set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            windowManager.flashFrame(true);
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(windowManager.mainWindow.flashFrame).not.toBeCalled();
            expect(windowManager.settingsWindow.flashFrame).not.toBeCalled();
        });

        it('linux/windows - should flash frame when config item is set', () => {
            Config.notifications = {
                flashWindow: true,
            };
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });
            windowManager.flashFrame(true);
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(windowManager.mainWindow.flashFrame).toBeCalledWith(true);
        });

        it('mac - should not bounce icon when config item is not set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            windowManager.flashFrame(true);
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(app.dock.bounce).not.toBeCalled();
        });

        it('mac - should bounce icon when config item is set', () => {
            Config.notifications = {
                bounceIcon: true,
                bounceIconType: 'critical',
            };
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            windowManager.flashFrame(true);
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
            expect(app.dock.bounce).toHaveBeenCalledWith('critical');
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
            windowManager.mainWindow = mainWindow;

            windowManager.mainWindow.isMaximized.mockReturnValue(false);
            windowManager.handleDoubleClick();
            expect(mainWindow.maximize).toHaveBeenCalled();

            windowManager.mainWindow.isMaximized.mockReturnValue(true);
            windowManager.handleDoubleClick();
            expect(mainWindow.unmaximize).toHaveBeenCalled();
        });

        it('mac - should minimize when not minimized and vice versa when setting is set', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            windowManager.flashFrame(true);

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
        windowManager.viewManager = {
            showByName: jest.fn(),
        };

        beforeEach(() => {
            jest.useFakeTimers();
            getTabViewName.mockImplementation((server, tab) => `${server}_${tab}`);

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

            const map = Config.teams.reduce((arr, item) => {
                item.tabs.forEach((tab) => {
                    arr.push([`${item.name}_${tab.name}`, {}]);
                });
                return arr;
            }, []);
            windowManager.viewManager.views = new Map(map);
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
        });

        it('should do nothing if cannot find the server', () => {
            windowManager.switchServer('server-3');
            expect(getTabViewName).not.toBeCalled();
            expect(windowManager.viewManager.showByName).not.toBeCalled();
        });

        it('should show first open tab in order when last active not defined', () => {
            windowManager.switchServer('server-1');
            expect(windowManager.viewManager.showByName).toHaveBeenCalledWith('server-1_tab-3');
        });

        it('should show last active tab of chosen server', () => {
            windowManager.switchServer('server-2');
            expect(windowManager.viewManager.showByName).toHaveBeenCalledWith('server-2_tab-2');
        });

        it('should wait for view to exist if specified', () => {
            windowManager.viewManager.views.delete('server-1_tab-3');
            windowManager.switchServer('server-1', true);
            expect(windowManager.viewManager.showByName).not.toBeCalled();

            jest.advanceTimersByTime(200);
            expect(windowManager.viewManager.showByName).not.toBeCalled();

            windowManager.viewManager.views.set('server-1_tab-3', {});
            jest.advanceTimersByTime(200);
            expect(windowManager.viewManager.showByName).toBeCalledWith('server-1_tab-3');
        });
    });

    describe('handleHistory', () => {
        const windowManager = new WindowManager();
        windowManager.viewManager = {
            getCurrentView: jest.fn(),
        };

        it('should only go to offset if it can', () => {
            const view = {
                view: {
                    webContents: {
                        goToOffset: jest.fn(),
                        canGoToOffset: () => false,
                    },
                },
            };
            windowManager.viewManager.getCurrentView.mockReturnValue(view);

            windowManager.handleHistory(null, 1);
            expect(view.view.webContents.goToOffset).not.toBeCalled();

            windowManager.viewManager.getCurrentView.mockReturnValue({
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
            windowManager.viewManager.getCurrentView.mockReturnValue(view);

            windowManager.handleHistory(null, 1);
            expect(view.load).toBeCalledWith('http://server-1.com');
        });
    });

    describe('selectTab', () => {
        const windowManager = new WindowManager();
        windowManager.viewManager = {
            getCurrentView: jest.fn(),
        };
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
            windowManager.viewManager.getCurrentView.mockReturnValue({
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
            windowManager.viewManager.getCurrentView.mockReturnValue({
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
            windowManager.viewManager.getCurrentView.mockReturnValue({
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

    describe('handleBrowserHistoryPush', () => {
        const windowManager = new WindowManager();
        const view1 = {
            name: 'server-1_tab-messaging',
            isLoggedIn: true,
            tab: {
                type: TAB_MESSAGING,
                server: {
                    url: 'http://server-1.com',
                },
            },
            view: {
                webContents: {
                    send: jest.fn(),
                },
            },
        };
        const view2 = {
            ...view1,
            name: 'server-1_other_type_1',
            tab: {
                ...view1.tab,
                type: 'other_type_1',
            },
            view: {
                webContents: {
                    send: jest.fn(),
                },
            },
        };
        const view3 = {
            ...view1,
            name: 'server-1_other_type_2',
            tab: {
                ...view1.tab,
                type: 'other_type_2',
            },
            view: {
                webContents: {
                    send: jest.fn(),
                },
            },
        };
        windowManager.viewManager = {
            views: new Map([
                ['server-1_tab-messaging', view1],
                ['server-1_other_type_1', view2],
            ]),
            closedViews: new Map([
                ['server-1_other_type_2', view3],
            ]),
            openClosedTab: jest.fn(),
            showByName: jest.fn(),
        };
        windowManager.handleBrowserHistoryButton = jest.fn();

        beforeEach(() => {
            Config.teams = [
                {
                    name: 'server-1',
                    url: 'http://server-1.com',
                    order: 0,
                    tabs: [
                        {
                            name: 'tab-messaging',
                            order: 0,
                            isOpen: true,
                        },
                        {
                            name: 'other_type_1',
                            order: 2,
                            isOpen: true,
                        },
                        {
                            name: 'other_type_2',
                            order: 1,
                            isOpen: false,
                        },
                    ],
                },
            ];
            urlUtils.cleanPathName.mockImplementation((base, path) => path);
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
        });

        it('should open closed view if pushing to it', () => {
            urlUtils.getView.mockReturnValue({name: 'server-1_other_type_2'});
            windowManager.viewManager.openClosedTab.mockImplementation((name) => {
                const view = windowManager.viewManager.closedViews.get(name);
                windowManager.viewManager.closedViews.delete(name);
                windowManager.viewManager.views.set(name, view);
            });

            windowManager.handleBrowserHistoryPush(null, 'server-1_tab-messaging', '/other_type_2/subpath');
            expect(windowManager.viewManager.openClosedTab).toBeCalledWith('server-1_other_type_2', 'http://server-1.com/other_type_2/subpath');
        });

        it('should open redirect view if different from current view', () => {
            urlUtils.getView.mockReturnValue({name: 'server-1_other_type_1'});
            windowManager.handleBrowserHistoryPush(null, 'server-1_tab-messaging', '/other_type_1/subpath');
            expect(windowManager.viewManager.showByName).toBeCalledWith('server-1_other_type_1');
        });

        it('should ignore redirects to "/" to Messages from other tabs', () => {
            urlUtils.getView.mockReturnValue({name: 'server-1_tab-messaging'});
            windowManager.handleBrowserHistoryPush(null, 'server-1_other_type_1', '/');
            expect(view1.view.webContents.send).not.toBeCalled();
        });
    });

    describe('handleBrowserHistoryButton', () => {
        const windowManager = new WindowManager();
        const view1 = {
            name: 'server-1_tab-messaging',
            isLoggedIn: true,
            isAtRoot: true,
            tab: {
                type: TAB_MESSAGING,
                server: {
                    url: 'http://server-1.com',
                },
                url: new URL('http://server-1.com'),
            },
            view: {
                webContents: {
                    canGoBack: jest.fn(),
                    canGoForward: jest.fn(),
                    clearHistory: jest.fn(),
                    send: jest.fn(),
                    getURL: jest.fn(),
                },
            },
        };
        windowManager.viewManager = {
            views: new Map([
                ['server-1_tab-messaging', view1],
            ]),
        };

        beforeEach(() => {
            Config.teams = [
                {
                    name: 'server-1',
                    url: 'http://server-1.com',
                    order: 0,
                    tabs: [
                        {
                            name: 'tab-messaging',
                            order: 0,
                            isOpen: true,
                        },
                    ],
                },
            ];
        });

        afterEach(() => {
            jest.resetAllMocks();
            Config.teams = [];
            view1.isAtRoot = true;
        });

        it('should erase history and set isAtRoot when navigating to root URL', () => {
            view1.isAtRoot = false;
            view1.view.webContents.getURL.mockReturnValue(view1.tab.url.toString());
            windowManager.handleBrowserHistoryButton(null, 'server-1_tab-messaging');
            expect(view1.view.webContents.clearHistory).toHaveBeenCalled();
            expect(view1.isAtRoot).toBe(true);
        });
    });
});
