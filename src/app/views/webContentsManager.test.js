// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MainWindow from 'app/mainWindow/mainWindow';
import ServerViewState from 'app/serverViewState';
import {BROWSER_HISTORY_PUSH, LOAD_SUCCESS, SET_ACTIVE_VIEW} from 'common/communication';
import ServerManager from 'common/servers/serverManager';
import PermissionsManager from 'main/security/permissionsManager';

import LoadingScreen from './loadingScreen';
import {MattermostWebContentsView} from './MattermostWebContentsView';
import {ViewManager} from './webContentsManager';

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
    lookupServerByURL: jest.fn(),
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
            MattermostWebContentsView.mockImplementation((server) => ({
                on: jest.fn(),
                load: loadFn,
                once: onceFn,
                destroy: destroyFn,
                id: server.id,
                server,
                webContentsId: 1,
            }));
        });

        afterEach(() => {
            jest.resetAllMocks();
            viewManager.views = new Map();
        });

        it('should add view to views map and add listeners', () => {
            viewManager.loadView({id: 'server1', url: new URL('http://server-1.com')}, 'http://server-1.com/subpath');
            expect(viewManager.views.has('server1')).toBe(true);
            expect(onceFn).toHaveBeenCalledWith(LOAD_SUCCESS, viewManager.activateView);
            expect(loadFn).toHaveBeenCalledWith('http://server-1.com/subpath');
        });

        it('should force a permission check for new views', () => {
            viewManager.loadView({id: 'server1', url: new URL('http://server-1.com')}, 'http://server-1.com/subpath');
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
            MattermostWebContentsView.mockImplementation((server) => ({
                on: jest.fn(),
                load: loadFn,
                once: onceFn,
                destroy: destroyFn,
                id: server.id,
                updateServerInfo: jest.fn(),
                server,
            }));
        });

        afterEach(() => {
            jest.resetAllMocks();
            delete viewManager.currentView;
            viewManager.views = new Map();
        });

        it('should recycle existing views', () => {
            const makeSpy = jest.spyOn(viewManager, 'makeView');
            const view = new MattermostWebContentsView({
                id: 'server1',
                url: new URL('http://server1.com'),
            });
            viewManager.views.set('view1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                url: new URL('http://server1.com'),
            }]);
            viewManager.handleReloadConfiguration();
            expect(viewManager.views.get('server1')).toBe(view);
            expect(makeSpy).not.toHaveBeenCalled();
            makeSpy.mockRestore();
        });

        it('should create new views for new views', () => {
            const makeSpy = jest.spyOn(viewManager, 'makeView');
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server1',
                name: 'server1',
                url: new URL('http://server1.com'),
            },
            {
                id: 'server2',
                name: 'server2',
                url: new URL('http://server2.com'),
            }]);
            viewManager.handleReloadConfiguration();
            expect(makeSpy).toHaveBeenCalledWith(
                {
                    id: 'server1',
                    name: 'server1',
                    url: new URL('http://server1.com'),
                },
                undefined,
            );
            expect(makeSpy).toHaveBeenCalledWith(
                {
                    id: 'server2',
                    name: 'server2',
                    url: new URL('http://server2.com'),
                },
                undefined,
            );
            makeSpy.mockRestore();
        });

        it('should set focus to current view on reload', () => {
            const view = {
                id: 'server-1',
                server: {
                    id: 'server-1',
                    url: new URL('http://server1.com'),
                },
                destroy: jest.fn(),
                updateServerInfo: jest.fn(),
                focus: jest.fn(),
            };
            viewManager.currentView = 'server-1';
            viewManager.views.set('server-1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server-1',
                url: new URL('http://server1.com'),
            }]);
            viewManager.handleReloadConfiguration();
            expect(view.focus).toHaveBeenCalled();
        });

        it('should show initial if currentView has been removed', () => {
            const view = {
                id: 'view1',
                server: {
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
                id: 'view1',
                server: {
                    id: 'view1',
                    url: new URL('http://server1.com'),
                },
                destroy: jest.fn(),
            };
            viewManager.views.set('view1', view);
            ServerManager.getAllServers.mockReturnValue([{
                id: 'server2',
                url: new URL('http://server2.com'),
            }]);
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
            ServerViewState.getCurrentServer.mockReturnValue({id: 'server-1'});
            viewManager.showInitial();
            expect(viewManager.showById).toHaveBeenCalledWith('server-1');
        });

        it('should open new server modal when no servers exist', () => {
            ServerManager.hasServers.mockReturnValue(false);
            viewManager.showInitial();
            expect(window.webContents.send).toHaveBeenCalledWith(SET_ACTIVE_VIEW);
        });
    });

    // TODO: Restore this if this logic needs to come back
    // describe('handleBrowserHistoryPush', () => {
    //     const viewManager = new ViewManager();
    //     viewManager.handleBrowserHistoryButton = jest.fn();
    //     viewManager.showById = jest.fn();
    //     const servers = [
    //         {
    //             name: 'server-1',
    //             url: 'http://server-1.com',
    //             order: 0,
    //         },
    //         {
    //             name: 'server-2',
    //             url: 'http://server-2.com',
    //             order: 1,
    //         },
    //         {
    //             name: 'server-3',
    //             url: 'http://server-3.com',
    //             order: 2,
    //         },
    //     ];
    //     const view1 = {
    //         id: 'server-1_channels',
    //         webContentsId: 1,
    //         isLoggedIn: true,
    //         server: {
    //             url: 'http://server-1.com',
    //         },
    //         sendToRenderer: jest.fn(),
    //         updateHistoryButton: jest.fn(),
    //     };
    //     const view2 = {
    //         ...view1,
    //         id: 'server-2_channels',
    //         webContentsId: 2,
    //         server: {
    //             url: 'http://server-2.com',
    //         },
    //     };
    //     const view3 = {
    //         ...view1,
    //         id: 'server-3_channels',
    //         webContentsId: 3,
    //         server: {
    //             url: 'http://server-3.com',
    //         },
    //     };
    //     const views = new Map([
    //         ['server-1_view-messaging', view1],
    //         ['server-1_other_type_1', view2],
    //         ['server-3_channels', view3],
    //     ]);
    //     viewManager.getView = (viewId) => views.get(viewId);
    //     viewManager.getViewByWebContentsId = (webContentsId) => [...views.values()].find((view) => view.webContentsId === webContentsId);

    //     beforeEach(() => {
    //         ServerManager.getAllServers.mockReturnValue(servers);
    //         ServerViewState.getCurrentServer.mockReturnValue(servers[0]);
    //         urlUtils.cleanPathName.mockImplementation((base, path) => path);
    //     });

    //     afterEach(() => {
    //         jest.resetAllMocks();
    //     });

    //     it('should open redirect view if different from current view', () => {
    //         ServerManager.lookupServerByURL.mockReturnValue({id: 'server-1_other_type_1'});
    //         viewManager.handleBrowserHistoryPush({sender: {id: 1}}, '/other_type_1/subpath');
    //         expect(viewManager.showById).toBeCalledWith('server-1_other_type_1');
    //     });

    //     it('should ignore redirects to "/" to Messages from other views', () => {
    //         ServerManager.lookupServerByURL.mockReturnValue({id: 'server-1_view-messaging'});
    //         viewManager.handleBrowserHistoryPush({sender: {id: 2}}, '/');
    //         expect(view1.sendToRenderer).not.toBeCalled();
    //     });
    // });

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
            server: {
                name: 'server-1',
            },
            type: 'view-1',
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
        });

        it('should load URL into matching view', () => {
            ServerManager.lookupServerByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            const view = {...baseView};
            viewManager.views.set('view1', view);
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(view.load).toHaveBeenCalledWith('http://server-1.com/deep/link?thing=yes');
        });

        it('should send the URL to the view if its already loaded on a 6.0 server', () => {
            ServerManager.lookupServerByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
            ServerManager.getRemoteInfo.mockReturnValue({serverVersion: '6.0.0'});
            const view = {
                ...baseView,
                server: {
                    url: new URL('http://server-1.com'),
                },
            };
            view.isReady.mockImplementation(() => true);
            viewManager.views.set('view1', view);
            viewManager.handleDeepLink('mattermost://server-1.com/deep/link?thing=yes');
            expect(view.sendToRenderer).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, '/deep/link?thing=yes');
        });

        it('should throw error if view is missing', () => {
            ServerManager.lookupServerByURL.mockImplementation(() => ({id: 'view1', url: new URL('http://server-1.com/')}));
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
    });
});
