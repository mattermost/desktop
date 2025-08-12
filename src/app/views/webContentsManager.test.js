// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ServerManager from 'common/servers/serverManager';
import ViewManager from 'common/views/viewManager';
import {flushCookiesStore} from 'main/app/utils';

import {WebContentsManager} from './webContentsManager';

jest.mock('electron', () => {
    const EventEmitter = jest.requireActual('events');
    const mockIpcMain = new EventEmitter();

    return {
        app: {
            getAppPath: () => '/path/to/app',
            getPath: jest.fn(() => '/valid/downloads/path'),
        },
        ipcMain: {
            emit: jest.fn((event, ...args) => mockIpcMain.emit(event, ...args)),
            on: jest.fn((event, handler) => mockIpcMain.on(event, handler)),
            handle: jest.fn(),
            mockIpcMain,
        },
    };
});
jest.mock('app/serverHub', () => ({
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

jest.mock('main/security/permissionsManager', () => ({
    getForServer: jest.fn(),
    doPermissionRequest: jest.fn(),
}));

jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));
jest.mock('app/views/loadingScreen', () => ({
    show: jest.fn(),
    fade: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
    on: jest.fn(),
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));

jest.mock('common/views/viewManager', () => ({
    getViewLog: jest.fn(),
    getView: jest.fn(),
}));

jest.mock('main/app/utils', () => ({
    flushCookiesStore: jest.fn(),
}));

jest.mock('electron-is-dev', () => false);
jest.mock('common/servers/serverManager', () => {
    const EventEmitter = jest.requireActual('events');
    const mockServerManager = new EventEmitter();

    return {
        getOrderedTabsForServer: jest.fn(),
        getAllServers: jest.fn(),
        hasServers: jest.fn(),
        getLastActiveServer: jest.fn(),
        getLastActiveTabForServer: jest.fn(),
        lookupServerByURL: jest.fn(),
        getRemoteInfo: jest.fn(),
        getServer: jest.fn(),
        on: jest.fn((event, handler) => mockServerManager.on(event, handler)),
        emit: jest.fn((event, ...args) => mockServerManager.emit(event, ...args)),
        setLoggedIn: jest.fn(),
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
        mockServerManager,
    };
});

jest.mock('./MattermostWebContentsView', () => ({
    MattermostWebContentsView: jest.fn(),
}));

jest.mock('app/mainWindow/modals/modalManager', () => ({
    showModal: jest.fn(),
    removeModal: jest.fn(),
    isModalDisplayed: jest.fn(),
}));
jest.mock('./webContentEvents', () => ({}));
jest.mock('common/appState', () => ({}));

describe('app/views/webContentsManager', () => {
    describe('getView', () => {
        const webContentsManager = new WebContentsManager();
        const mockView = {id: 'test-view', webContentsId: 1};

        beforeEach(() => {
            webContentsManager.webContentsViews = new Map();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return view when it exists', () => {
            webContentsManager.webContentsViews.set('test-view', mockView);
            const result = webContentsManager.getView('test-view');
            expect(result).toBe(mockView);
        });

        it('should return undefined when view does not exist', () => {
            const result = webContentsManager.getView('non-existent-view');
            expect(result).toBeUndefined();
        });
    });

    describe('getViewByWebContentsId', () => {
        const webContentsManager = new WebContentsManager();
        const mockView = {id: 'test-view', webContentsId: 123};

        beforeEach(() => {
            webContentsManager.webContentsIdToView = new Map();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return view when webContentsId exists', () => {
            webContentsManager.webContentsIdToView.set(123, mockView);
            const result = webContentsManager.getViewByWebContentsId(123);
            expect(result).toBe(mockView);
        });

        it('should return undefined when webContentsId does not exist', () => {
            const result = webContentsManager.getViewByWebContentsId(999);
            expect(result).toBeUndefined();
        });
    });

    describe('getFocusedView', () => {
        const webContentsManager = new WebContentsManager();
        const mockView = {id: 'focused-view', webContentsId: 1};

        beforeEach(() => {
            webContentsManager.webContentsViews = new Map();
            webContentsManager.focusedWebContentsView = undefined;
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return undefined when no view is focused', () => {
            const result = webContentsManager.getFocusedView();
            expect(result).toBeUndefined();
        });

        it('should return focused view when one exists', () => {
            webContentsManager.focusedWebContentsView = 'focused-view';
            webContentsManager.webContentsViews.set('focused-view', mockView);
            const result = webContentsManager.getFocusedView();
            expect(result).toBe(mockView);
        });

        it('should return undefined when focused view does not exist in views map', () => {
            webContentsManager.focusedWebContentsView = 'non-existent-view';
            const result = webContentsManager.getFocusedView();
            expect(result).toBeUndefined();
        });
    });

    describe('sendToAllViews', () => {
        const webContentsManager = new WebContentsManager();
        const mockView1 = {
            id: 'view1',
            isDestroyed: jest.fn().mockReturnValue(false),
            sendToRenderer: jest.fn(),
        };
        const mockView2 = {
            id: 'view2',
            isDestroyed: jest.fn().mockReturnValue(false),
            sendToRenderer: jest.fn(),
        };
        const mockView3 = {
            id: 'view3',
            isDestroyed: jest.fn().mockReturnValue(true), // destroyed view
            sendToRenderer: jest.fn(),
        };

        beforeEach(() => {
            webContentsManager.webContentsViews = new Map([
                ['view1', mockView1],
                ['view2', mockView2],
                ['view3', mockView3],
            ]);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should send message to all non-destroyed views', () => {
            webContentsManager.sendToAllViews('test-channel', 'arg1', 'arg2');

            expect(mockView1.sendToRenderer).toHaveBeenCalledWith('test-channel', 'arg1', 'arg2');
            expect(mockView2.sendToRenderer).toHaveBeenCalledWith('test-channel', 'arg1', 'arg2');
            expect(mockView3.sendToRenderer).not.toHaveBeenCalled();
        });
    });

    describe('removeView', () => {
        const webContentsManager = new WebContentsManager();
        const mockView = {
            id: 'test-view',
            webContentsId: 123,
            destroy: jest.fn(),
        };

        beforeEach(() => {
            webContentsManager.webContentsViews = new Map();
            webContentsManager.webContentsIdToView = new Map();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should remove existing view', () => {
            webContentsManager.webContentsViews.set('test-view', mockView);
            webContentsManager.webContentsIdToView.set(123, mockView);

            webContentsManager.removeView('test-view');

            expect(mockView.destroy).toHaveBeenCalled();
            expect(webContentsManager.webContentsViews.has('test-view')).toBe(false);
            expect(webContentsManager.webContentsIdToView.has(123)).toBe(false);
        });

        it('should do nothing when view does not exist', () => {
            webContentsManager.removeView('non-existent-view');

            expect(mockView.destroy).not.toHaveBeenCalled();
        });
    });

    describe('getServerURLByViewId', () => {
        const webContentsManager = new WebContentsManager();
        const mockView = {id: 'test-view', serverId: 'server-1'};
        const mockServer = {id: 'server-1', url: new URL('http://test.com')};

        beforeEach(() => {
            ViewManager.getView.mockReturnValue(mockView);
            ServerManager.getServer.mockReturnValue(mockServer);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return server URL when view and server exist', () => {
            const result = webContentsManager.getServerURLByViewId('test-view');
            expect(result).toBe(mockServer.url);
            expect(ViewManager.getView).toHaveBeenCalledWith('test-view');
            expect(ServerManager.getServer).toHaveBeenCalledWith('server-1');
        });

        it('should return undefined when view does not exist', () => {
            ViewManager.getView.mockReturnValue(undefined);
            const result = webContentsManager.getServerURLByViewId('non-existent-view');
            expect(result).toBeUndefined();
        });

        it('should return undefined when server does not exist', () => {
            ServerManager.getServer.mockReturnValue(undefined);
            const result = webContentsManager.getServerURLByViewId('test-view');
            expect(result).toBeUndefined();
        });
    });

    describe('handleTabLoginChanged', () => {
        const webContentsManager = new WebContentsManager();
        const mockEvent = {
            sender: {id: 123},
        };
        const mockView = {
            id: 'test-view',
            serverId: 'server-1',
        };

        beforeEach(() => {
            webContentsManager.webContentsIdToView = new Map();
            ServerManager.setLoggedIn = jest.fn();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should handle login state change for existing view', () => {
            webContentsManager.webContentsIdToView.set(123, mockView);

            // Emit the IPC event
            const ipcMain = require('electron').ipcMain;
            ipcMain.emit('tab-login-changed', mockEvent, true);

            expect(ServerManager.setLoggedIn).toHaveBeenCalledWith('server-1', true);
            expect(flushCookiesStore).toHaveBeenCalled();
        });

        it('should handle logout state change for existing view', () => {
            webContentsManager.webContentsIdToView.set(123, mockView);

            // Emit the IPC event
            const ipcMain = require('electron').ipcMain;
            ipcMain.emit('tab-login-changed', mockEvent, false);

            expect(ServerManager.setLoggedIn).toHaveBeenCalledWith('server-1', false);
            expect(flushCookiesStore).toHaveBeenCalled();
        });

        it('should do nothing when view does not exist', () => {
            // Emit the IPC event
            const ipcMain = require('electron').ipcMain;
            ipcMain.emit('tab-login-changed', mockEvent, true);

            expect(ServerManager.setLoggedIn).not.toHaveBeenCalled();
            expect(flushCookiesStore).not.toHaveBeenCalled();
        });
    });
});
