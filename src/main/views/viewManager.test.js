// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ServerViewState from 'app/serverViewState';
import {BROWSER_HISTORY_PUSH, LOAD_SUCCESS, SET_ACTIVE_VIEW} from 'common/communication';
import ServerManager from 'common/servers/serverManager';
import urlUtils from 'common/utils/url';
import {TAB_MESSAGING} from 'common/views/View';
import PermissionsManager from 'main/permissionsManager';
import MainWindow from 'main/windows/mainWindow';

import LoadingScreen from './loadingScreen';
import {MattermostWebContentsView} from './MattermostWebContentsView';
import {ViewManager} from './viewManager';

jest.mock('electron', () => ({
    app: {
        getAppPath: () => '/path/to/app',
        getPath: jest.fn(() => '/valid/downloads/path'),
    },
    ipcMain: {
        emit: jest.fn(),
        on: jest.fn(),
        handle: jest.fn(),
    },
}));
jest.mock('app/serverViewState', () => ({
    getCurrentServer: jest.fn(),
    updateCurrentView: jest.fn(),
    init: jest.fn(),
    showNewServerModal: jest.fn(),
}));
jest.mock('common/views/View', () => ({
    getViewName: jest.fn((a, b) => `${a}-${b}`),
    TAB_MESSAGING: 'view',
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
    getFormattedPathName: (pathname) => (pathname.length ? pathname : '/'),
    equalUrlsIgnoringSubpath: jest.fn(),
}));

jest.mock('main/app/utils', () => ({
    flushCookiesStore: jest.fn(),
}));

jest.mock('main/app/intercom', () => ({
    handleWelcomeScreenModal: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('main/permissionsManager', () => ({
    getForServer: jest.fn(),
    doPermissionRequest: jest.fn(),
}));

jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));
jest.mock('main/views/loadingScreen', () => ({
    show: jest.fn(),
    fade: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
    on: jest.fn(),
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('common/servers/serverManager', () => ({
    getOrderedTabsForServer: jest.fn(),
    getAllServers: jest.fn(),
    hasServers: jest.fn(),
    getLastActiveServer: jest.fn(),
    getLastActiveTabForServer: jest.fn(),
    lookupViewByURL: jest.fn(),
    getRemoteInfo: jest.fn(),
    on: jest.fn(),
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

jest.mock('./MattermostWebContentsView', () => ({
    MattermostWebContentsView: jest.fn(),
}));

jest.mock('main/views/modalManager', () => ({
    showModal: jest.fn(),
    removeModal: jest.fn(),
    isModalDisplayed: jest.fn(),
}));
jest.mock('./webContentEvents', () => ({}));
jest.mock('common/appState', () => ({}));

describe('main/views/viewManager', () => {
    describe('loadView', () => {
        const viewManager = new ViewManager();
        const onceFn = jest.fn();
        const loadFn = jest.fn();
        const destroyFn = jest.fn();

        beforeEach(() => {
            viewManager.showById = jest.fn();
            MainWindow.get.mockReturnValue({});
            MattermostWebContentsView.mockImplementation((view) => ({
                on: jest.fn(),
                load: loadFn,
                once: onceFn,
                destroy: destroyFn,
                id: view.id,
                view,
                webContentsId: 1,
            }));
        });

        afterEach(() => {
            jest.resetAllMocks();
            viewManager.closedViews = new Map();
            viewManager.views = new Map();
        });

        it('should add closed views to closedViews', () => {
            viewManager.loadView({id: 'server1'}, {id: 'view1', isOpen: false});
            expect(viewManager.closedViews.has('view1')).toBe(true);
        });

        it('should add view to views map and add listeners', () => {
            viewManager.loadView({id: 'server1'}, {id: 'view1', isOpen: true}, 'http://server-1.com/subpath');
            expect(viewManager.views.has('view1')).toBe(true);
            expect(onceFn).toHaveBeenCalledWith(LOAD_SUCCESS, viewManager.activateView);
            expect(loadFn).toHaveBeenCalledWith('http://server-1.com/subpath');
        });

        it('should force a permission check for new views', () => {
            viewManager.loadView({id: 'server1'}, {id: 'view1', isOpen: true, type: TAB_MESSAGING, server: {url: new URL('http://server-1.com')}}, 'http://server-1.com/subpath');
            expect(PermissionsManager.doPermissionRequest).toBeCalledWith(
                1,
                'notifications',
                {
                    requestingUrl: 'http://server-1.com/',
                    isMainFrame: false,
                },
            );
        });
    });

    describe('openClosedView', () => {
        const viewManager = new ViewManager();

        beforeEach(() => {
            viewManager.showById = jest.fn();
            MainWindow.get.mockReturnValue({});
            MattermostWebContentsView.mockImplementation((view) => ({
                on: jest.fn(),
                load: jest.fn(),
                once: jest.fn(),
                destroy: jest.fn(),
                id: view.id,
                view,
            }));
        });

        it('should remove from closedViews when the view is open', () => {
            viewManager.closedViews.set('view1', {srv: {id: 'server1'}, view: {id: 'view1'}});
            expect(viewManager.closedViews.has('view1')).toBe(true);
            viewManager.openClosedView('view1');
            expect(viewManager.closedViews.has('view1')).toBe(false);
        });
    });

    describe('reload', () => {
        const viewManager = new ViewManager();
        const currentView = {
            currentURL: new URL('http://server-1.com/team/channel'),
            reload: jest.fn(),
        };
        viewManager.views.set('view1', currentView);
        viewManager.currentView = 'view1';

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should reload using the current URL', () => {
            viewManager.reload();
            expect(currentView.reload).toBeCalledWith(new URL('http://server-1.com/team/channel'));
        });
    });

    describe('handleReloadConfiguration', () => {
        const viewManager = new ViewManager();

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
            MattermostWebContentsView.mockImplementation((view) => ({
                on: jest.fn(),
                load: loadFn,
                once: onceFn,
                destroy: destroyFn,
                id: view.id,
                updateServerInfo: jest.fn(),
                view,
            }));
        });

        afterEach(() => {
            jest.resetAllMocks();
            delete viewManager.currentView;
            viewManager.closedViews = new Map();
            viewManager.views = new Map();
        });

        it('should recycle existing views', () => {
            const makeSpy = jest.spyOn(viewManager, 'makeView');
            const view = new MattermostWebContentsView({
                id: 'view1',
                server: {
                    id: 'server1',
                },
            });
            viewManager.views.set('view1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                url: new URL('http://server1.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'view1',
                    isOpen: true,
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(viewManager.views.get('view1')).toBe(view);
            expect(makeSpy).not.toHaveBeenCalled();
            makeSpy.mockRestore();
        });

        it('should close views that arent open', () => {
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                url: new URL('http://server1.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'view1',
                    isOpen: false,
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(viewManager.closedViews.has('view1')).toBe(true);
        });

        it('should create new views for new views', () => {
            const makeSpy = jest.spyOn(viewManager, 'makeView');
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                name: 'server1',
                url: new URL('http://server1.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'view1',
                    name: 'view1',
                    isOpen: true,
                    url: new URL('http://server1.com/view'),
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
                    id: 'view1',
                    name: 'view1',
                    isOpen: true,
                    url: new URL('http://server1.com/view'),
                },
                undefined,
            );
            makeSpy.mockRestore();
        });

        it('should set focus to current view on reload', () => {
            const view = {
                id: 'view1',
                view: {
                    server: {
                        id: 'server-1',
                    },
                    id: 'view1',
                    url: new URL('http://server1.com'),
                },
                destroy: jest.fn(),
                updateServerInfo: jest.fn(),
                focus: jest.fn(),
            };
            viewManager.currentView = 'view1';
            viewManager.views.set('view1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                url: new URL('http://server1.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'view1',
                    isOpen: true,
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(view.focus).toHaveBeenCalled();
        });

        it('should show initial if currentView has been removed', () => {
            const view = {
                id: 'view1',
                view: {
                    id: 'view1',
                    url: new URL('http://server1.com'),
                },
                destroy: jest.fn(),
                updateServerInfo: jest.fn(),
            };
            viewManager.currentView = 'view1';
            viewManager.views.set('view1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server2',
                url: new URL('http://server2.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'view1',
                    isOpen: false,
                },
            ]);
            viewManager.handleReloadConfiguration();
            expect(viewManager.showInitial).toBeCalled();
        });

        it('should remove unused views', () => {
            const view = {
                name: 'view1',
                view: {
                    name: 'view1',
                    url: new URL('http://server1.com'),
                },
                destroy: jest.fn(),
            };
            viewManager.views.set('view1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server2',
                url: new URL('http://server2.com'),
            }]);
            ServerManager.getOrderedTabsForServer.mockReturnValue([
                {
                    id: 'view1',
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
            ServerViewState.getCurrentServer.mockReturnValue({id: 'server-0'});
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should show last active view and server', () => {
            ServerManager.getLastActiveServer.mockReturnValue({id: 'server-1'});
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'view-1'});
            viewManager.showInitial();
            expect(viewManager.showById).toHaveBeenCalledWith('view-1');
        });

        it('should open new server modal when no servers exist', () => {
            ServerManager.hasServers.mockReturnValue(false);
            viewManager.showInitial();
            expect(window.webContents.send).toHaveBeenCalledWith(SET_ACTIVE_VIEW);
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
                        name: 'view-messaging',
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
            id: 'server-1_view-messaging',
            webContentsId: 1,
            isLoggedIn: true,
            view: {
                type: TAB_MESSAGING,
                server: {
                    url: 'http://server-1.com',
                },
            },
            sendToRenderer: jest.fn(),
            updateHistoryButton: jest.fn(),
        };
        const view2 = {
            ...view1,
            id: 'server-1_other_type_1',
            webContentsId: 2,
            view: {
                ...view1.view,
                type: 'other_type_1',
            },
        };
        const view3 = {
            ...view1,
            id: 'server-1_other_type_2',
            webContentsId: 3,
            view: {
                ...view1.view,
                type: 'other_type_2',
            },
        };
        const views = new Map([
            ['server-1_view-messaging', view1],
            ['server-1_other_type_1', view2],
        ]);
        const closedViews = new Map([
            ['server-1_other_type_2', view3],
        ]);
        viewManager.getView = (viewId) => views.get(viewId);
        viewManager.isViewClosed = (viewId) => closedViews.has(viewId);
        viewManager.openClosedView = jest.fn();
        viewManager.getViewByWebContentsId = (webContentsId) => [...views.values()].find((view) => view.webContentsId === webContentsId);

        beforeEach(() => {
            ServerManager.getAllServers.mockReturnValue(servers);
            ServerViewState.getCurrentServer.mockReturnValue(servers[0]);
            urlUtils.cleanPathName.mockImplementation((base, path) => path);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should open closed view if pushing to it', () => {
            viewManager.openClosedView.mockImplementation((name) => {
                const view = closedViews.get(name);
                closedViews.delete(name);
                views.set(name, view);
            });
            ServerManager.lookupViewByURL.mockReturnValue({id: 'server-1_other_type_2'});
            viewManager.handleBrowserHistoryPush({sender: {id: 1}}, '/other_type_2/subpath');
            expect(viewManager.openClosedView).toBeCalledWith('server-1_other_type_2', 'http://server-1.com/other_type_2/subpath');
        });

        it('should open redirect view if different from current view', () => {
            ServerManager.lookupViewByURL.mockReturnValue({id: 'server-1_other_type_1'});
            viewManager.handleBrowserHistoryPush({sender: {id: 1}}, '/other_type_1/subpath');
            expect(viewManager.showById).toBeCalledWith('server-1_other_type_1');
        });

        it('should ignore redirects to "/" to Messages from other views', () => {
            ServerManager.lookupViewByURL.mockReturnValue({id: 'server-1_view-messaging'});
            viewManager.handleBrowserHistoryPush({sender: {id: 2}}, '/');
            expect(view1.sendToRenderer).not.toBeCalled();
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
            view: {
                server: {
                    name: 'server-1',
                },
                type: 'view-1',
            },
        };

        beforeEach(() => {
            viewManager.getCurrentView = jest.fn();
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
            viewManager.views.set('server1-view1', view);

            viewManager.showById('server1-view1');
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
            expect(LoadingScreen.show).toHaveBeenCalled();
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

    describe('handleDeepLink', () => {
        const viewManager = new ViewManager({});
        const baseView = {
            resetLoadingStatus: jest.fn(),
            load: jest.fn(),
            once: jest.fn(),
            isReady: jest.fn(),
            sendToRenderer: jest.fn(),
            serverInfo: {
                remoteInfo: {
                    serverVersion: '1.0.0',
                },
            },
        };

        beforeEach(() => {
            viewManager.openClosedView = jest.fn();
        });

        afterEach(() => {
            jest.resetAllMocks();
            viewManager.views = new Map();
            viewManager.closedViews = new Map();
        });

        it('should load URL into matching view', () => {
            ServerManager.lookupViewByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            const view = {...baseView};
            viewManager.views.set('view1', view);
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(view.load).toHaveBeenCalledWith('http://server-1.com/deep/link?thing=yes');
        });

        it('should send the URL to the view if its already loaded on a 6.0 server', () => {
            ServerManager.lookupViewByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            ServerManager.getRemoteInfo.mockReturnValue({serverVersion: '6.0.0'});
            const view = {
                ...baseView,
                view: {
                    server: {
                        url: new URL('http://server-1.com'),
                    },
                },
            };
            view.isReady.mockImplementation(() => true);
            viewManager.views.set('view1', view);
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(view.sendToRenderer).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, '/deep/link?thing=yes');
        });

        it('should throw error if view is missing', () => {
            ServerManager.lookupViewByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            const view = {...baseView};
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(view.load).not.toHaveBeenCalled();
        });

        it('should open new server modal when using a server that does not exist', () => {
            ServerManager.hasServers.mockReturnValue(true);
            const view = {...baseView};
            viewManager.handleDeepLink('mattermost://server-2.com/deep/link?thing=yes');
            expect(view.load).not.toHaveBeenCalled();
            expect(ServerViewState.showNewServerModal).toHaveBeenCalled();
        });

        it('should reopen closed view if called upon', () => {
            ServerManager.lookupViewByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            viewManager.closedViews.set('view1', {});
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(viewManager.openClosedView).toHaveBeenCalledWith('view1', 'http://server-1.com/deep/link?thing=yes');
        });
    });
});
