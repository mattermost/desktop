// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
'use strict';

import {dialog, ipcMain} from 'electron';

import {BROWSER_HISTORY_PUSH, LOAD_SUCCESS, MAIN_WINDOW_SHOWN, SET_ACTIVE_VIEW} from 'common/communication';
import {TAB_MESSAGING} from 'common/tabs/TabView';
import ServerManager from 'common/servers/serverManager';
import urlUtils from 'common/utils/url';

import MainWindow from 'main/windows/mainWindow';

import {MattermostView} from './MattermostView';
import {ViewManager} from './viewManager';

jest.mock('electron', () => ({
    app: {
        getAppPath: () => '/path/to/app',
    },
    dialog: {
        showErrorBox: jest.fn(),
    },
    ipcMain: {
        emit: jest.fn(),
        on: jest.fn(),
        handle: jest.fn(),
    },
}));

jest.mock('common/tabs/TabView', () => ({
    getTabViewName: jest.fn((a, b) => `${a}-${b}`),
    TAB_MESSAGING: 'tab',
}));

jest.mock('common/servers/MattermostServer', () => ({
    MattermostServer: jest.fn(),
}));

jest.mock('common/utils/url', () => ({
    isTeamUrl: jest.fn(),
    isAdminUrl: jest.fn(),
    cleanPathName: jest.fn(),
    parseURL: (url) => {
        try {
            return new URL(url);
        } catch (e) {
            return null;
        }
    },
    equalUrlsIgnoringSubpath: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));

jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    getCurrentServer: jest.fn(),
    getOrderedTabsForServer: jest.fn(),
    getAllServers: jest.fn(),
    hasServers: jest.fn(),
    getLastActiveServer: jest.fn(),
    getLastActiveTabForServer: jest.fn(),
    lookupTabByURL: jest.fn(),
    getRemoteInfo: jest.fn(),
    on: jest.fn(),
}));

jest.mock('./MattermostView', () => ({
    MattermostView: jest.fn(),
}));

jest.mock('./modalManager', () => ({
    showModal: jest.fn(),
    isModalDisplayed: jest.fn(),
}));
jest.mock('./webContentEvents', () => ({}));

describe('main/views/viewManager', () => {
    describe('loadView', () => {
        const viewManager = new ViewManager({});
        const onceFn = jest.fn();
        const loadFn = jest.fn();
        const destroyFn = jest.fn();

        beforeEach(() => {
            viewManager.createLoadingScreen = jest.fn();
            viewManager.showById = jest.fn();
            MainWindow.get.mockReturnValue({});
            MattermostView.mockImplementation((tab) => ({
                on: jest.fn(),
                load: loadFn,
                once: onceFn,
                destroy: destroyFn,
                id: tab.id,
            }));
        });

        afterEach(() => {
            jest.resetAllMocks();
            viewManager.loadingScreen = undefined;
            viewManager.closedViews = new Map();
            viewManager.views = new Map();
        });

        it('should add closed tabs to closedViews', () => {
            viewManager.loadView({id: 'server1'}, {id: 'tab1', isOpen: false});
            expect(viewManager.closedViews.has('tab1')).toBe(true);
        });

        it('should remove from remove from closedViews when the tab is open', () => {
            viewManager.closedViews.set('tab1', {});
            expect(viewManager.closedViews.has('tab1')).toBe(true);
            viewManager.loadView({id: 'server1'}, {id: 'tab1', isOpen: true});
            expect(viewManager.closedViews.has('tab1')).toBe(false);
        });

        it('should add view to views map and add listeners', () => {
            viewManager.loadView({id: 'server1'}, {id: 'tab1', isOpen: true}, 'http://server-1.com/subpath');
            expect(viewManager.views.has('tab1')).toBe(true);
            expect(viewManager.createLoadingScreen).toHaveBeenCalled();
            expect(onceFn).toHaveBeenCalledWith(LOAD_SUCCESS, viewManager.activateView);
            expect(loadFn).toHaveBeenCalledWith('http://server-1.com/subpath');
        });
    });

    describe('handleAppLoggedIn', () => {
        const viewManager = new ViewManager({});

        afterEach(() => {
            jest.resetAllMocks();
            viewManager.views = new Map();
        });

        it('should reload view when URL is not on subpath of original server URL', () => {
            const view = {
                load: jest.fn(),
                view: {
                    webContents: {
                        getURL: () => 'http://server-2.com/subpath',
                    },
                },
                tab: {
                    url: new URL('http://server-1.com/'),
                },
            };
            viewManager.views.set('view1', view);
            viewManager.handleAppLoggedIn(null, 'view1');
            expect(view.load).toHaveBeenCalledWith(new URL('http://server-1.com/'));
        });

        it('should not reload if URLs are matching', () => {
            const view = {
                load: jest.fn(),
                view: {
                    webContents: {
                        getURL: () => 'http://server-1.com/',
                    },
                },
                tab: {
                    url: new URL('http://server-1.com/'),
                },
            };
            viewManager.views.set('view1', view);
            viewManager.handleAppLoggedIn(null, 'view1');
            expect(view.load).not.toHaveBeenCalled();
        });

        it('should not reload if URL is subpath of server URL', () => {
            const view = {
                load: jest.fn(),
                view: {
                    webContents: {
                        getURL: () => 'http://server-1.com/subpath',
                    },
                },
                tab: {
                    url: new URL('http://server-1.com/'),
                },
            };
            viewManager.views.set('view1', view);
            viewManager.handleAppLoggedIn(null, 'view1');
            expect(view.load).not.toHaveBeenCalled();
        });
    });

    describe('handleReloadConfiguration', () => {
        const viewManager = new ViewManager({});

        beforeEach(() => {
            viewManager.loadView = jest.fn();
            viewManager.showById = jest.fn();
            viewManager.showInitial = jest.fn();
            viewManager.focus = jest.fn();
            MainWindow.get.mockReturnValue({
                webContents: {
                    send: jest.fn(),
                },
            });

            const onceFn = jest.fn();
            const loadFn = jest.fn();
            const destroyFn = jest.fn();
            MattermostView.mockImplementation((tab) => ({
                on: jest.fn(),
                load: loadFn,
                once: onceFn,
                destroy: destroyFn,
                id: tab.id,
                updateServerInfo: jest.fn(),
                tab,
            }));
        });

        afterEach(() => {
            jest.resetAllMocks();
            delete viewManager.loadingScreen;
            delete viewManager.currentView;
            viewManager.closedViews = new Map();
            viewManager.views = new Map();
        });

        it('should recycle existing views', () => {
            const makeSpy = jest.spyOn(viewManager, 'makeView');
            const view = new MattermostView({
                id: 'tab1',
                server: {
                    id: 'server1',
                },
            });
            viewManager.views.set('tab1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                url: new URL('http://server1.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'tab1',
                    isOpen: true,
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(viewManager.views.get('tab1')).toBe(view);
            expect(makeSpy).not.toHaveBeenCalled();
            makeSpy.mockRestore();
        });

        it('should close tabs that arent open', () => {
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                url: new URL('http://server1.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'tab1',
                    isOpen: false,
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(viewManager.closedViews.has('tab1')).toBe(true);
        });

        it('should create new views for new tabs', () => {
            const makeSpy = jest.spyOn(viewManager, 'makeView');
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                name: 'server1',
                url: new URL('http://server1.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'tab1',
                    name: 'tab1',
                    isOpen: true,
                    url: new URL('http://server1.com/tab'),
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(makeSpy).toHaveBeenCalledWith(
                {
                    id: 'server1',
                    name: 'server1',
                    url: new URL('http://server1.com'),
                },
                {
                    id: 'tab1',
                    name: 'tab1',
                    isOpen: true,
                    url: new URL('http://server1.com/tab'),
                },
            );
            makeSpy.mockRestore();
        });

        it('should set focus to current view on reload', () => {
            const view = {
                id: 'tab1',
                tab: {
                    server: {
                        id: 'server-1',
                    },
                    id: 'tab1',
                    url: new URL('http://server1.com'),
                },
                destroy: jest.fn(),
                updateServerInfo: jest.fn(),
                focus: jest.fn(),
            };
            viewManager.currentView = 'tab1';
            viewManager.views.set('tab1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                url: new URL('http://server1.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'tab1',
                    isOpen: true,
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(view.focus).toHaveBeenCalled();
        });

        it('should show initial if currentView has been removed', () => {
            const view = {
                id: 'tab1',
                tab: {
                    id: 'tab1',
                    url: new URL('http://server1.com'),
                },
                destroy: jest.fn(),
                updateServerInfo: jest.fn(),
            };
            viewManager.currentView = 'tab1';
            viewManager.views.set('tab1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server2',
                url: new URL('http://server2.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'tab1',
                    isOpen: false,
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(viewManager.showInitial).toBeCalled();
        });

        it('should remove unused views', () => {
            const view = {
                name: 'tab1',
                tab: {
                    name: 'tab1',
                    url: new URL('http://server1.com'),
                },
                destroy: jest.fn(),
            };
            viewManager.views.set('tab1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server2',
                url: new URL('http://server2.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'tab1',
                    isOpen: false,
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(view.destroy).toBeCalled();
            expect(viewManager.showInitial).toBeCalled();
        });
    });

    describe('showInitial', () => {
        const viewManager = new ViewManager();
        const window = {webContents: {send: jest.fn()}};

        beforeEach(() => {
            viewManager.showById = jest.fn();
            MainWindow.get.mockReturnValue(window);
            ServerManager.hasServers.mockReturnValue(true);
            ServerManager.getCurrentServer.mockReturnValue({id: 'server-0'});
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should show last active tab and server', () => {
            ServerManager.getLastActiveServer.mockReturnValue({id: 'server-1'});
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'tab-1'});
            viewManager.showInitial();
            expect(viewManager.showById).toHaveBeenCalledWith('tab-1');
        });

        it('should open new server modal when no servers exist', () => {
            ServerManager.hasServers.mockReturnValue(false);
            viewManager.showInitial();
            expect(window.webContents.send).toHaveBeenCalledWith(SET_ACTIVE_VIEW);
            expect(ipcMain.emit).toHaveBeenCalledWith(MAIN_WINDOW_SHOWN);
        });
    });

    describe('handleBrowserHistoryPush', () => {
        const viewManager = new ViewManager();
        viewManager.handleBrowserHistoryButton = jest.fn();
        viewManager.showById = jest.fn();
        const servers = [
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
        const view1 = {
            id: 'server-1_tab-messaging',
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
            id: 'server-1_other_type_1',
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
            id: 'server-1_other_type_2',
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
        const views = new Map([
            ['server-1_tab-messaging', view1],
            ['server-1_other_type_1', view2],
        ]);
        const closedViews = new Map([
            ['server-1_other_type_2', view3],
        ]);
        viewManager.getView = (viewId) => views.get(viewId);
        viewManager.isViewClosed = (viewId) => closedViews.has(viewId);
        viewManager.openClosedTab = jest.fn();

        beforeEach(() => {
            ServerManager.getAllServers.mockReturnValue(servers);
            ServerManager.getCurrentServer.mockReturnValue(servers[0]);
            urlUtils.cleanPathName.mockImplementation((base, path) => path);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should open closed view if pushing to it', () => {
            viewManager.openClosedTab.mockImplementation((name) => {
                const view = closedViews.get(name);
                closedViews.delete(name);
                views.set(name, view);
            });
            ServerManager.lookupTabByURL.mockReturnValue({id: 'server-1_other_type_2'});
            viewManager.handleBrowserHistoryPush(null, 'server-1_tab-messaging', '/other_type_2/subpath');
            expect(viewManager.openClosedTab).toBeCalledWith('server-1_other_type_2', 'http://server-1.com/other_type_2/subpath');
        });

        it('should open redirect view if different from current view', () => {
            ServerManager.lookupTabByURL.mockReturnValue({id: 'server-1_other_type_1'});
            viewManager.handleBrowserHistoryPush(null, 'server-1_tab-messaging', '/other_type_1/subpath');
            expect(viewManager.showById).toBeCalledWith('server-1_other_type_1');
        });

        it('should ignore redirects to "/" to Messages from other tabs', () => {
            ServerManager.lookupTabByURL.mockReturnValue({id: 'server-1_tab-messaging'});
            viewManager.handleBrowserHistoryPush(null, 'server-1_other_type_1', '/');
            expect(view1.view.webContents.send).not.toBeCalled();
        });
    });

    describe('handleBrowserHistoryButton', () => {
        const viewManager = new ViewManager();
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
        viewManager.getView = jest.fn();

        beforeEach(() => {
            ServerManager.getAllServers.mockReturnValue([
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
            ]);
            viewManager.getView.mockReturnValue(view1);
        });

        afterEach(() => {
            jest.resetAllMocks();
            view1.isAtRoot = true;
        });

        it('should erase history and set isAtRoot when navigating to root URL', () => {
            view1.isAtRoot = false;
            view1.view.webContents.getURL.mockReturnValue(view1.tab.url.toString());
            viewManager.handleBrowserHistoryButton(null, 'server-1_tab-messaging');
            expect(view1.view.webContents.clearHistory).toHaveBeenCalled();
            expect(view1.isAtRoot).toBe(true);
        });
    });

    describe('showById', () => {
        const viewManager = new ViewManager({});
        const baseView = {
            isReady: jest.fn(),
            isErrored: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            needsLoadingScreen: jest.fn(),
            window: {
                webContents: {
                    send: jest.fn(),
                },
            },
            tab: {
                server: {
                    name: 'server-1',
                },
                type: 'tab-1',
            },
        };

        beforeEach(() => {
            viewManager.getCurrentView = jest.fn();
            viewManager.showLoadingScreen = jest.fn();
            viewManager.fadeLoadingScreen = jest.fn();
        });

        afterEach(() => {
            jest.resetAllMocks();
            viewManager.views = new Map();
            delete viewManager.currentView;
        });

        it('should do nothing when view is already visible or if view doesnt exist', () => {
            const view = {
                ...baseView,
                isVisible: true,
            };
            viewManager.views.set('server1-tab1', view);

            viewManager.showById('server1-tab1');
            expect(viewManager.currentView).toBeUndefined();
            expect(view.isReady).not.toBeCalled();
            expect(view.show).not.toBeCalled();

            viewManager.showById('some-view-name');
            expect(viewManager.currentView).toBeUndefined();
            expect(view.isReady).not.toBeCalled();
            expect(view.show).not.toBeCalled();
        });

        it('should hide current view when new view is shown', () => {
            const oldView = {
                ...baseView,
                isVisible: true,
            };
            const newView = {
                ...baseView,
                isVisible: false,
            };
            viewManager.getCurrentView.mockImplementation(() => oldView);
            viewManager.views.set('oldView', oldView);
            viewManager.views.set('newView', newView);
            viewManager.currentView = 'oldView';
            viewManager.showById('newView');
            expect(oldView.hide).toHaveBeenCalled();
        });

        it('should not show the view when it is in error state', () => {
            const view = {...baseView};
            view.isErrored.mockReturnValue(true);
            viewManager.views.set('view1', view);
            viewManager.showById('view1');
            expect(view.show).not.toHaveBeenCalled();
        });

        it('should show loading screen when the view needs it', () => {
            const view = {...baseView};
            view.isErrored.mockReturnValue(false);
            view.needsLoadingScreen.mockImplementation(() => true);
            viewManager.views.set('view1', view);
            viewManager.showById('view1');
            expect(viewManager.showLoadingScreen).toHaveBeenCalled();
        });

        it('should show the view when not errored', () => {
            const view = {...baseView};
            view.needsLoadingScreen.mockImplementation(() => false);
            view.isErrored.mockReturnValue(false);
            viewManager.views.set('view1', view);
            viewManager.showById('view1');
            expect(viewManager.currentView).toBe('view1');
            expect(view.show).toHaveBeenCalled();
        });
    });

    describe('showLoadingScreen', () => {
        const window = {
            getBrowserViews: jest.fn(),
            setTopBrowserView: jest.fn(),
            addBrowserView: jest.fn(),
        };
        const viewManager = new ViewManager();
        const loadingScreen = {webContents: {send: jest.fn(), isLoading: () => false}};

        beforeEach(() => {
            viewManager.createLoadingScreen = jest.fn();
            viewManager.setLoadingScreenBounds = jest.fn();
            window.getBrowserViews.mockImplementation(() => []);
            MainWindow.get.mockReturnValue(window);
        });

        afterEach(() => {
            jest.resetAllMocks();
            delete viewManager.loadingScreen;
        });

        it('should create new loading screen if one doesnt exist and add it to the window', () => {
            viewManager.createLoadingScreen.mockImplementation(() => {
                viewManager.loadingScreen = loadingScreen;
            });
            viewManager.showLoadingScreen();
            expect(viewManager.createLoadingScreen).toHaveBeenCalled();
            expect(window.addBrowserView).toHaveBeenCalled();
        });

        it('should set the browser view as top if already exists and needs to be shown', () => {
            viewManager.loadingScreen = loadingScreen;
            window.getBrowserViews.mockImplementation(() => [loadingScreen]);
            viewManager.showLoadingScreen();
            expect(window.setTopBrowserView).toHaveBeenCalled();
        });
    });

    describe('handleDeepLink', () => {
        const viewManager = new ViewManager({});
        const baseView = {
            resetLoadingStatus: jest.fn(),
            load: jest.fn(),
            once: jest.fn(),
            isInitialized: jest.fn(),
            view: {
                webContents: {
                    send: jest.fn(),
                },
            },
            serverInfo: {
                remoteInfo: {
                    serverVersion: '1.0.0',
                },
            },
        };

        beforeEach(() => {
            viewManager.openClosedTab = jest.fn();
        });

        afterEach(() => {
            jest.resetAllMocks();
            viewManager.views = new Map();
            viewManager.closedViews = new Map();
        });

        it('should load URL into matching view', () => {
            ServerManager.lookupTabByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            const view = {...baseView};
            viewManager.views.set('view1', view);
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(view.load).toHaveBeenCalledWith('http://server-1.com/deep/link?thing=yes');
        });

        it('should send the URL to the view if its already loaded on a 6.0 server', () => {
            ServerManager.lookupTabByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            ServerManager.getRemoteInfo.mockReturnValue({serverVersion: '6.0.0'});
            const view = {
                ...baseView,
                tab: {
                    server: {
                        url: new URL('http://server-1.com'),
                    },
                },
            };
            view.isInitialized.mockImplementation(() => true);
            viewManager.views.set('view1', view);
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(view.view.webContents.send).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, '/deep/link?thing=yes');
        });

        it('should throw error if view is missing', () => {
            ServerManager.lookupTabByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            const view = {...baseView};
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(view.load).not.toHaveBeenCalled();
        });

        it('should throw dialog when cannot find the view', () => {
            const view = {...baseView};
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(view.load).not.toHaveBeenCalled();
            expect(dialog.showErrorBox).toHaveBeenCalled();
        });

        it('should reopen closed tab if called upon', () => {
            ServerManager.lookupTabByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            viewManager.closedViews.set('view1', {});
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(viewManager.openClosedTab).toHaveBeenCalledWith('view1', 'http://server-1.com/deep/link?thing=yes');
        });
    });
});
