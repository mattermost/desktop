// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain, session} from 'electron';

import AppState from 'common/appState';
import ServerManager from 'common/servers/serverManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {flushCookiesStore} from 'main/app/utils';
import SystemAppearanceMonitor from 'main/systemAppearanceMonitor';
import ThemeManager from 'main/themeManager';

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
        session: {
            defaultSession: {
                clearCache: jest.fn(),
            },
        },
        nativeTheme: {
            on: jest.fn(),
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
    getFormattedPathName: (pathname) => (pathname.endsWith('/') ? pathname : `${pathname}/`),
    isInternalURL: (targetURL, currentURL) => targetURL.host === currentURL.host && targetURL.protocol === currentURL.protocol,
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

jest.mock('main/systemAppearanceMonitor', () => ({
    getSystemAppearance: jest.fn(),
    subscribeInvalidation: jest.fn(),
}));

jest.mock('main/themeManager', () => ({
    applyDesktopTheme: jest.fn(),
    handleDesktopThemeDocumentInvalidated: jest.fn(),
    handleDesktopThemeViewInvalidated: jest.fn(),
    isDesktopThemeDocumentCutover: jest.fn(() => false),
    registerDesktopThemeSurface: jest.fn(),
    releaseDesktopThemeSurface: jest.fn(),
    updatePopoutTheme: jest.fn(),
}));

jest.mock('common/views/viewManager', () => ({
    getViewLog: jest.fn(),
    getView: jest.fn(),
    getPrimaryView: jest.fn(),
    isPrimaryView: jest.fn(),
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
        updateTheme: jest.fn(),
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
jest.mock('common/appState', () => ({
    updateExpired: jest.fn(),
    updateUnreadsAndMentionsPerServer: jest.fn(),
}));
jest.mock('app/popoutMenu', () => ({
    default: jest.fn(),
}));

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

    describe('getAuthenticatedDesktopThemeDocument', () => {
        const webContentsManager = new WebContentsManager();
        const frame = {
            detached: false,
            isDestroyed: jest.fn().mockReturnValue(false),
            origin: 'https://mattermost.example.com',
            url: 'https://mattermost.example.com/workspace/channels/town-square',
        };
        const webContents = {id: 123, mainFrame: frame};
        const mockView = {
            id: 'test-view',
            serverId: 'server-1',
            isDestroyed: jest.fn().mockReturnValue(false),
            getWebContentsView: jest.fn(() => ({webContents})),
        };
        const mattermostView = {
            id: 'test-view',
            serverId: 'server-1',
            type: ViewType.TAB,
        };
        const server = {
            id: 'server-1',
            url: new URL('https://mattermost.example.com/workspace'),
        };

        beforeEach(() => {
            webContentsManager.webContentsIdToView = new Map([[123, mockView]]);
            frame.detached = false;
            frame.isDestroyed.mockReturnValue(false);
            frame.origin = 'https://mattermost.example.com';
            frame.url = 'https://mattermost.example.com/workspace/channels/town-square';
            webContents.mainFrame = frame;
            mockView.isDestroyed.mockReturnValue(false);
            mockView.getWebContentsView.mockReturnValue({webContents});
            ViewManager.getView.mockReturnValue(mattermostView);
            ServerManager.getServer.mockReturnValue(server);
            ThemeManager.isDesktopThemeDocumentCutover.mockReturnValue(false);
        });

        afterEach(() => {
            webContentsManager.webContentsIdToView = new Map();
            jest.clearAllMocks();
        });

        it('authenticates the mapped live main-frame document', () => {
            const result = webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame});

            expect(result).toEqual({
                viewId: 'test-view',
                serverId: 'server-1',
                viewType: ViewType.TAB,
                webContents,
                frame,
                scope: 'main-tab',
            });
        });

        it('rejects a sender whose mapped view is stale', () => {
            mockView.isDestroyed.mockReturnValue(true);

            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame})).toBeUndefined();

            mockView.isDestroyed.mockReturnValue(false);
            mockView.getWebContentsView.mockReturnValue({webContents: {id: 123, mainFrame: frame}});

            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame})).toBeUndefined();
        });

        it('rejects a missing, destroyed, detached, or non-main frame', () => {
            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: null})).toBeUndefined();

            frame.isDestroyed.mockReturnValue(true);
            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame})).toBeUndefined();

            frame.isDestroyed.mockReturnValue(false);
            frame.detached = true;
            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame})).toBeUndefined();

            frame.detached = false;
            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({
                sender: webContents,
                senderFrame: {...frame},
            })).toBeUndefined();
        });

        it('rejects a view whose current metadata no longer matches', () => {
            ViewManager.getView.mockReturnValue(undefined);
            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame})).toBeUndefined();

            ViewManager.getView.mockReturnValue({...mattermostView, serverId: 'server-2'});
            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame})).toBeUndefined();
        });

        it('rejects a document outside the configured origin or server subpath', () => {
            frame.origin = 'https://attacker.example.com';
            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame})).toBeUndefined();

            frame.origin = 'https://mattermost.example.com';
            frame.url = 'https://mattermost.example.com/workspace-other/channels/town-square';
            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame})).toBeUndefined();

            frame.url = 'https://attacker.example.com/workspace/channels/town-square';
            frame.origin = 'https://attacker.example.com';
            expect(webContentsManager.getAuthenticatedDesktopThemeDocument({sender: webContents, senderFrame: frame})).toBeUndefined();
        });

        it('delegates v1 operations only after document authentication', async () => {
            const event = {sender: webContents, senderFrame: frame};
            const request = {
                surfaceId: 'surface-id',
                leaseId: 'lease-id',
                sequence: 1,
                directive: {mode: 'system', shellTheme: {}},
            };
            ThemeManager.registerDesktopThemeSurface.mockResolvedValue({surfaceId: 'surface-id'});
            ThemeManager.applyDesktopTheme.mockResolvedValue({status: 'applied'});
            ThemeManager.releaseDesktopThemeSurface.mockResolvedValue({status: 'released'});
            SystemAppearanceMonitor.getSystemAppearance.mockResolvedValue({revision: 1, status: 'known', value: 'light'});

            await expect(webContentsManager.handleGetSystemAppearance(event)).resolves.toMatchObject({status: 'known', value: 'light'});
            await webContentsManager.handleRegisterDesktopThemeSurface(event);
            await webContentsManager.handleApplyDesktopTheme(event, request);
            await webContentsManager.handleReleaseDesktopThemeSurface(event, 'surface-id');

            expect(ThemeManager.registerDesktopThemeSurface).toHaveBeenCalledWith(expect.objectContaining({viewId: 'test-view', frame}));
            expect(ThemeManager.applyDesktopTheme).toHaveBeenCalledWith(expect.objectContaining({viewId: 'test-view', frame}), request);
            expect(ThemeManager.releaseDesktopThemeSurface).toHaveBeenCalledWith(expect.objectContaining({viewId: 'test-view', frame}), 'surface-id');
        });

        it('returns a frame rejection without delegating an unauthenticated apply', async () => {
            const request = {
                surfaceId: 'surface-id',
                leaseId: 'lease-id',
                sequence: 1,
                directive: {mode: 'system', shellTheme: {}},
            };

            expect(webContentsManager.handleApplyDesktopTheme({sender: webContents, senderFrame: null}, request)).toMatchObject({
                status: 'rejected',
                reason: 'invalid-document',
            });
            expect(ThemeManager.applyDesktopTheme).not.toHaveBeenCalled();
        });

        it('stores legacy updates only while the frame remains legacy', () => {
            const event = {sender: webContents, senderFrame: frame};
            const theme = {centerChannelBg: '#111111'};

            webContentsManager.handleUpdateTheme(event, theme);
            expect(ServerManager.updateTheme).toHaveBeenCalled();

            ThemeManager.isDesktopThemeDocumentCutover.mockReturnValue(true);
            ServerManager.updateTheme.mockClear();
            webContentsManager.handleUpdateTheme(event, theme);
            expect(ServerManager.updateTheme).not.toHaveBeenCalled();
        });
    });

    describe('desktop theme document lifecycle', () => {
        const webContentsManager = new WebContentsManager();
        const handlers = {};
        const frame = {};
        const webContents = {
            on: jest.fn((event, handler) => {
                handlers[event] = handler;
            }),
        };

        beforeEach(() => {
            webContentsManager.appearanceConsumers = new Map([[frame, {webContents}]]);
            webContentsManager.addDesktopThemeLifecycleListeners(webContents);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('retires the current document when its replacement commits', () => {
            expect(webContentsManager.appearanceConsumers.has(frame)).toBe(true);

            handlers['did-frame-navigate']({}, 'https://mattermost.example.com', 200, 'OK', true);

            expect(webContentsManager.appearanceConsumers.has(frame)).toBe(false);
            expect(ThemeManager.handleDesktopThemeDocumentInvalidated).toHaveBeenCalledWith(webContents, undefined);
        });

        it('retains the current document when navigation is cancelled', () => {
            expect(webContentsManager.appearanceConsumers.has(frame)).toBe(true);
            expect(ThemeManager.handleDesktopThemeDocumentInvalidated).not.toHaveBeenCalled();
        });

        it('ignores subframe navigations', () => {
            handlers['did-frame-navigate']({}, 'https://mattermost.example.com', 200, 'OK', false);

            expect(ThemeManager.handleDesktopThemeDocumentInvalidated).not.toHaveBeenCalled();
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
            ViewManager.isPrimaryView.mockReturnValue(true);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should handle login state change for existing view', () => {
            webContentsManager.webContentsIdToView.set(123, mockView);

            ipcMain.emit('tab-login-changed', mockEvent, true);

            expect(ServerManager.setLoggedIn).toHaveBeenCalledWith('server-1', true);
            expect(flushCookiesStore).toHaveBeenCalled();
        });

        it('should handle logout state change for primary view', () => {
            webContentsManager.webContentsIdToView.set(123, mockView);
            ViewManager.isPrimaryView.mockReturnValue(true);

            ipcMain.emit('tab-login-changed', mockEvent, false);

            expect(ServerManager.setLoggedIn).toHaveBeenCalledWith('server-1', false);
            expect(flushCookiesStore).toHaveBeenCalled();
        });

        it('should ignore logout from non-primary view', () => {
            webContentsManager.webContentsIdToView.set(123, mockView);
            ViewManager.isPrimaryView.mockReturnValue(false);

            ipcMain.emit('tab-login-changed', mockEvent, false);

            expect(ServerManager.setLoggedIn).not.toHaveBeenCalled();
            expect(flushCookiesStore).not.toHaveBeenCalled();
        });

        it('should still accept login from non-primary view', () => {
            webContentsManager.webContentsIdToView.set(123, mockView);
            ViewManager.isPrimaryView.mockReturnValue(false);

            ipcMain.emit('tab-login-changed', mockEvent, true);

            expect(ServerManager.setLoggedIn).toHaveBeenCalledWith('server-1', true);
            expect(flushCookiesStore).toHaveBeenCalled();
        });

        it('should do nothing when view does not exist', () => {
            ipcMain.emit('tab-login-changed', mockEvent, true);

            expect(ServerManager.setLoggedIn).not.toHaveBeenCalled();
            expect(flushCookiesStore).not.toHaveBeenCalled();
        });
    });

    describe('handleSessionExpired', () => {
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
            ViewManager.getViewLog.mockReturnValue({debug: jest.fn()});
            ViewManager.isPrimaryView.mockReturnValue(true);
            AppState.updateExpired.mockClear();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should mark logged out when primary view session expires', () => {
            webContentsManager.webContentsIdToView.set(123, mockView);
            ViewManager.isPrimaryView.mockReturnValue(true);

            ipcMain.emit('session_expired', mockEvent, true);

            expect(ServerManager.setLoggedIn).toHaveBeenCalledWith('server-1', false);
            expect(AppState.updateExpired).toHaveBeenCalledWith('server-1', true);
        });

        it('should ignore session expiry from non-primary view', () => {
            webContentsManager.webContentsIdToView.set(123, mockView);
            ViewManager.isPrimaryView.mockReturnValue(false);

            ipcMain.emit('session_expired', mockEvent, true);

            expect(ServerManager.setLoggedIn).not.toHaveBeenCalled();
            expect(AppState.updateExpired).not.toHaveBeenCalled();
        });
    });

    describe('clearCacheAndReloadView', () => {
        const webContentsManager = new WebContentsManager();
        const mockView = {
            id: 'test-view-id',
            reload: jest.fn(),
            currentURL: 'https://example.com/test',
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should clear cache and reload view when view exists', () => {
            webContentsManager.webContentsViews.set('test-view-id', mockView);
            webContentsManager.clearCacheAndReloadView('test-view-id');

            expect(session.defaultSession.clearCache).toHaveBeenCalled();
            expect(mockView.reload).toHaveBeenCalledWith('https://example.com/test');
        });

        it('should clear cache but not reload when view does not exist', () => {
            webContentsManager.clearCacheAndReloadView('non-existent-view');
            expect(session.defaultSession.clearCache).toHaveBeenCalled();
        });

        it('should clear cache but not reload when view is null', () => {
            webContentsManager.clearCacheAndReloadView(null);
            expect(session.defaultSession.clearCache).toHaveBeenCalled();
        });
    });
});
