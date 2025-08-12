// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import WebContentsManager from 'app/views/webContentsManager';
import BaseWindow from 'app/windows/baseWindow';
import {
    LOAD_FAILED,
    LOADSCREEN_END,
    RELOAD_VIEW,
    UPDATE_TAB_TITLE,
    VIEW_CREATED,
    VIEW_REMOVED,
    VIEW_UPDATED,
} from 'common/communication';
import ServerManager from 'common/servers/serverManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import performanceMonitor from 'main/performanceMonitor';

import {PopoutManager} from './popoutManager';

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn(),
    },
}));

jest.mock('app/views/webContentsManager', () => ({
    createView: jest.fn(),
    removeView: jest.fn(),
}));

jest.mock('app/windows/baseWindow', () => {
    const mockBrowserWindow = {
        webContents: {
            id: 123,
            send: jest.fn(),
            focus: jest.fn(),
        },
        contentView: {
            addChildView: jest.fn(),
            removeChildView: jest.fn(),
            on: jest.fn(),
        },
        on: jest.fn(),
        once: jest.fn(),
        show: jest.fn(),
        close: jest.fn(),
        setTitle: jest.fn(),
        loadURL: jest.fn(() => Promise.resolve()),
    };

    return jest.fn(() => ({
        browserWindow: mockBrowserWindow,
        showLoadingScreen: jest.fn(),
        fadeLoadingScreen: jest.fn(),
    }));
});

jest.mock('common/servers/serverManager', () => {
    const EventEmitter = jest.requireActual('events');
    const mockServerManager = new EventEmitter();

    return {
        on: jest.fn((event, handler) => mockServerManager.on(event, handler)),
        emit: jest.fn((event, ...args) => mockServerManager.emit(event, ...args)),
        getServer: jest.fn(),
        mockServerManager,
    };
});

jest.mock('common/views/viewManager', () => {
    const EventEmitter = jest.requireActual('events');
    const mockViewManager = new EventEmitter();

    return {
        on: jest.fn((event, handler) => mockViewManager.on(event, handler)),
        emit: jest.fn((event, ...args) => mockViewManager.emit(event, ...args)),
        getView: jest.fn(),
        createView: jest.fn(),
        mockViewManager,
    };
});

jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));

jest.mock('main/utils', () => ({
    getWindowBoundaries: jest.fn(() => ({x: 0, y: 0, width: 800, height: 600})),
}));

describe('PopoutManager', () => {
    const mockBaseWindow = {
        browserWindow: {
            webContents: {
                id: 123,
                send: jest.fn(),
                focus: jest.fn(),
            },
            contentView: {
                addChildView: jest.fn(),
                removeChildView: jest.fn(),
                on: jest.fn(),
            },
            on: jest.fn(),
            once: jest.fn(),
            show: jest.fn(),
            close: jest.fn(),
            setTitle: jest.fn(),
            loadURL: jest.fn(() => Promise.resolve()),
        },
        showLoadingScreen: jest.fn(),
        fadeLoadingScreen: jest.fn(),
    };

    const mockWebContentsView = {
        on: jest.fn(),
        getWebContentsView: jest.fn(() => ({
            webContents: {
                focus: jest.fn(),
                on: jest.fn(),
            },
            setBounds: jest.fn(),
        })),
        needsLoadingScreen: jest.fn(() => false),
    };

    const mockView = {
        id: 'test-view-id',
        serverId: 'test-server-id',
        title: 'Test Window',
        type: ViewType.WINDOW,
    };

    const mockServer = {
        id: 'test-server-id',
        name: 'Test Server',
    };

    beforeEach(() => {
        // Clear all mock calls
        jest.clearAllMocks();

        BaseWindow.mockImplementation(() => mockBaseWindow);
        WebContentsManager.createView.mockReturnValue(mockWebContentsView);
        ViewManager.getView.mockReturnValue(mockView);
        ServerManager.getServer.mockReturnValue(mockServer);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createNewWindow', () => {
        const popoutManager = new PopoutManager();

        it('should call handleCreateNewWindow with serverId', () => {
            const mockNewView = {
                id: 'new-window-id',
                serverId: 'test-server-id',
                type: ViewType.WINDOW,
            };

            ServerManager.getServer.mockReturnValue(mockServer);
            ViewManager.createView.mockReturnValue(mockNewView);

            popoutManager.createNewWindow('test-server-id');

            expect(ViewManager.createView).toHaveBeenCalledWith(mockServer, ViewType.WINDOW);
        });
    });

    describe('getWindow', () => {
        const popoutManager = new PopoutManager();

        it('should return window for existing viewId', () => {
            popoutManager.popoutWindows.set('test-view-id', mockBaseWindow);

            const result = popoutManager.getWindow('test-view-id');

            expect(result).toBe(mockBaseWindow);
        });

        it('should return undefined for non-existing viewId', () => {
            const result = popoutManager.getWindow('non-existing-view-id');

            expect(result).toBeUndefined();
        });
    });

    describe('getViewIdByWindowWebContentsId', () => {
        const popoutManager = new PopoutManager();

        it('should return viewId for matching webContentsId', () => {
            popoutManager.popoutWindows.set('test-view-id', mockBaseWindow);

            const result = popoutManager.getViewIdByWindowWebContentsId(123);

            expect(result).toBe('test-view-id');
        });

        it('should return undefined for non-matching webContentsId', () => {
            popoutManager.popoutWindows.set('test-view-id', mockBaseWindow);

            const result = popoutManager.getViewIdByWindowWebContentsId(456);

            expect(result).toBeUndefined();
        });
    });

    describe('handleViewCreated', () => {
        const popoutManager = new PopoutManager();

        it('should create new window for WINDOW type view', () => {
            const mockWindowView = {
                id: 'new-window-id',
                serverId: 'test-server-id',
                type: ViewType.WINDOW,
            };

            ViewManager.getView.mockReturnValue(mockWindowView);

            ViewManager.mockViewManager.emit(VIEW_CREATED, 'new-window-id');

            expect(BaseWindow).toHaveBeenCalledWith({});
            expect(performanceMonitor.registerView).toHaveBeenCalledWith('PopoutWindow-new-window-id', mockBaseWindow.browserWindow.webContents);
            expect(mockBaseWindow.browserWindow.loadURL).toHaveBeenCalledWith('mattermost-desktop://renderer/popout.html');
            expect(WebContentsManager.createView).toHaveBeenCalledWith(mockWindowView, mockBaseWindow);
            expect(popoutManager.popoutWindows.get('new-window-id')).toBe(mockBaseWindow);
            expect(mockBaseWindow.browserWindow.show).toHaveBeenCalled();
        });

        it('should not create window for non-WINDOW type view', () => {
            const mockTabView = {
                id: 'new-tab-id',
                serverId: 'test-server-id',
                type: ViewType.TAB,
            };

            ViewManager.getView.mockReturnValue(mockTabView);

            ViewManager.mockViewManager.emit(VIEW_CREATED, 'new-tab-id');

            expect(BaseWindow).not.toHaveBeenCalled();
            expect(popoutManager.popoutWindows.has('new-tab-id')).toBe(false);
        });

        it('should set up event listeners for window view', () => {
            const mockWindowView = {
                id: 'new-window-id',
                serverId: 'test-server-id',
                type: ViewType.WINDOW,
            };

            ViewManager.getView.mockReturnValue(mockWindowView);

            ViewManager.mockViewManager.emit(VIEW_CREATED, 'new-window-id');

            expect(mockWebContentsView.on).toHaveBeenCalledWith(LOADSCREEN_END, expect.any(Function));
            expect(mockWebContentsView.on).toHaveBeenCalledWith(LOAD_FAILED, expect.any(Function));
            expect(mockWebContentsView.on).toHaveBeenCalledWith(RELOAD_VIEW, expect.any(Function));
            expect(mockBaseWindow.browserWindow.contentView.on).toHaveBeenCalledWith('bounds-changed', expect.any(Function));
            expect(mockBaseWindow.browserWindow.on).toHaveBeenCalledWith('focus', expect.any(Function));
            expect(mockBaseWindow.browserWindow.once).toHaveBeenCalledWith('show', expect.any(Function));
        });

        it('should show loading screen if needed', () => {
            const mockWindowView = {
                id: 'new-window-id',
                serverId: 'test-server-id',
                type: ViewType.WINDOW,
            };

            ViewManager.getView.mockReturnValue(mockWindowView);
            mockWebContentsView.needsLoadingScreen.mockReturnValue(true);

            ViewManager.mockViewManager.emit(VIEW_CREATED, 'new-window-id');

            expect(mockBaseWindow.showLoadingScreen).toHaveBeenCalled();
        });

        it('should handle loadURL failure', () => {
            const mockWindowView = {
                id: 'new-window-id',
                serverId: 'test-server-id',
                type: ViewType.WINDOW,
            };

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            mockBaseWindow.browserWindow.loadURL.mockRejectedValue(new Error('Load failed'));

            ViewManager.getView.mockReturnValue(mockWindowView);

            ViewManager.mockViewManager.emit(VIEW_CREATED, 'new-window-id');

            expect(mockBaseWindow.browserWindow.loadURL).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('handleViewUpdated', () => {
        const popoutManager = new PopoutManager();

        it('should update window title for WINDOW type view', () => {
            const mockWindowView = {
                id: 'test-view-id',
                serverId: 'test-server-id',
                title: 'Updated Title',
                type: ViewType.WINDOW,
            };

            popoutManager.popoutWindows.set('test-view-id', mockBaseWindow);
            ViewManager.getView.mockReturnValue(mockWindowView);

            ViewManager.mockViewManager.emit(VIEW_UPDATED, 'test-view-id');

            expect(mockBaseWindow.browserWindow.setTitle).toHaveBeenCalledWith('Test Server - Updated Title');
            expect(mockBaseWindow.browserWindow.webContents.send).toHaveBeenCalledWith(UPDATE_TAB_TITLE, 'test-view-id', 'Test Server - Updated Title');
        });

        it('should not update title for non-WINDOW type view', () => {
            const mockTabView = {
                id: 'test-view-id',
                serverId: 'test-server-id',
                title: 'Updated Title',
                type: ViewType.TAB,
            };

            popoutManager.popoutWindows.set('test-view-id', mockBaseWindow);
            ViewManager.getView.mockReturnValue(mockTabView);

            ViewManager.mockViewManager.emit(VIEW_UPDATED, 'test-view-id');

            expect(mockBaseWindow.browserWindow.setTitle).not.toHaveBeenCalled();
        });

        it('should not update title for non-existing window', () => {
            const mockWindowView = {
                id: 'test-view-id',
                serverId: 'test-server-id',
                title: 'Updated Title',
                type: ViewType.WINDOW,
            };

            ViewManager.getView.mockReturnValue(mockWindowView);

            // Create a fresh mock for this test to avoid interference from other tests
            const freshMockBaseWindow = {
                browserWindow: {
                    setTitle: jest.fn(),
                },
            };

            // Mock BaseWindow to return our fresh mock
            BaseWindow.mockImplementation(() => freshMockBaseWindow);

            // Don't add the window to popoutWindows, so it should not exist
            ViewManager.mockViewManager.emit(VIEW_UPDATED, 'test-view-id');

            // The setTitle should not be called because the window doesn't exist in popoutWindows
            expect(freshMockBaseWindow.browserWindow.setTitle).not.toHaveBeenCalled();
        });
    });

    describe('handleViewRemoved', () => {
        const popoutManager = new PopoutManager();

        it('should close and remove window for existing viewId', () => {
            popoutManager.popoutWindows.set('test-view-id', mockBaseWindow);

            ViewManager.mockViewManager.emit(VIEW_REMOVED, 'test-view-id');

            expect(WebContentsManager.removeView).toHaveBeenCalledWith('test-view-id');
            expect(mockBaseWindow.browserWindow.close).toHaveBeenCalled();
            expect(popoutManager.popoutWindows.has('test-view-id')).toBe(false);
        });

        it('should handle removal of non-existing window gracefully', () => {
            ViewManager.mockViewManager.emit(VIEW_REMOVED, 'non-existing-view-id');

            expect(WebContentsManager.removeView).not.toHaveBeenCalled();
            expect(mockBaseWindow.browserWindow.close).not.toHaveBeenCalled();
        });
    });
});
