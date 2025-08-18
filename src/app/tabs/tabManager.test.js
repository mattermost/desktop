// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcMain} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import WebContentsManager from 'app/views/webContentsManager';
import {
    ACTIVE_TAB_CHANGED,
    TAB_ORDER_UPDATED,
    TAB_ADDED,
    TAB_REMOVED,
    VIEW_CREATED,
    VIEW_REMOVED,
    SERVER_SWITCHED,
    VIEW_TITLE_UPDATED,
    UPDATE_TAB_TITLE,
    CREATE_NEW_TAB,
    SWITCH_TAB,
    CLOSE_TAB,
    SERVER_LOGGED_IN_CHANGED,
    UPDATE_TAB_ORDER,
    VIEW_TYPE_REMOVED,
    VIEW_TYPE_ADDED,
} from 'common/communication';
import ServerManager from 'common/servers/serverManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';

import {TabManager} from './tabManager';

jest.mock('electron', () => {
    const EventEmitter = jest.requireActual('events');
    const mockIpcMain = new EventEmitter();
    mockIpcMain.handle = jest.fn((event, handler) => mockIpcMain.on(event, handler));

    return {
        ipcMain: mockIpcMain,
        mockIpcMain,
    };
});

jest.mock('app/mainWindow/mainWindow', () => ({
    on: jest.fn(),
    get: jest.fn(),
    window: {
        showLoadingScreen: jest.fn(),
        fadeLoadingScreen: jest.fn(),
        sendToRenderer: jest.fn(),
    },
}));

jest.mock('app/mainWindow/modals/modalManager', () => ({
    isModalDisplayed: jest.fn(),
    focusCurrentModal: jest.fn(),
}));

jest.mock('app/views/webContentsManager', () => ({
    createView: jest.fn(),
    getView: jest.fn(),
    removeView: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => {
    const EventEmitter = jest.requireActual('events');
    const mockServerManager = new EventEmitter();

    return {
        on: jest.fn((event, handler) => mockServerManager.on(event, handler)),
        emit: jest.fn((event, ...args) => mockServerManager.emit(event, ...args)),
        getCurrentServerId: jest.fn(),
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
        getPrimaryView: jest.fn(),
        createView: jest.fn(),
        removeView: jest.fn(),
        isPrimaryView: jest.fn(),
        getViewLog: jest.fn(() => ({
            debug: jest.fn(),
        })),
        mockViewManager,
    };
});

describe('TabManager', () => {
    const mockWebContentsView = {
        on: jest.fn(),
        getWebContentsView: jest.fn(() => ({
            webContents: {
                focus: jest.fn(),
                on: jest.fn(),
            },
            setBounds: jest.fn(),
        })),
        focus: jest.fn(),
        setBounds: jest.fn(),
        reload: jest.fn(),
        currentURL: 'https://test.com',
        serverId: 'test-server-id',
        isErrored: jest.fn(() => false),
        needsLoadingScreen: jest.fn(() => false),
    };
    const mockView = {
        id: 'test-view-id',
        serverId: 'test-server-id',
        title: 'Test Tab',
        type: ViewType.TAB,
        isErrored: jest.fn(() => false),
        toUniqueView: jest.fn(() => ({
            id: 'test-view-id',
            serverId: 'test-server-id',
            title: 'Test Tab',
            type: ViewType.TAB,
        })),
    };

    const mockMainWindow = {
        webContents: {
            send: jest.fn(),
        },
        contentView: {
            addChildView: jest.fn(),
            removeChildView: jest.fn(),
        },
        getContentBounds: jest.fn(() => ({width: 800, height: 600})),
        sendToRenderer: jest.fn(),
    };

    const mockServer = {
        id: 'test-server-id',
        isLoggedIn: true,
    };

    beforeEach(() => {
        MainWindow.get.mockReturnValue(mockMainWindow);

        WebContentsManager.getView.mockReturnValue(mockWebContentsView);
        WebContentsManager.createView.mockReturnValue(mockWebContentsView);

        ViewManager.getView.mockReturnValue(mockView);
        ViewManager.isPrimaryView.mockReturnValue(false);

        ServerManager.getCurrentServerId.mockReturnValue('test-server-id');
        ServerManager.getServer.mockReturnValue(mockServer);
    });

    describe('getOrderedTabsForServer', () => {
        const tabManager = new TabManager();
        it('should return empty array for server with no tabs', () => {
            const result = tabManager.getOrderedTabsForServer('non-existent-server');
            expect(result).toEqual([]);
        });

        it('should return ordered tabs for server', () => {
            const tabIds = ['tab1', 'tab2', 'tab3'];
            tabManager.tabOrder.set('test-server-id', tabIds);

            ViewManager.getView.mockImplementation((id) => ({
                id,
                serverId: 'test-server-id',
                title: id,
                type: ViewType.TAB,
                toUniqueView: jest.fn(() => ({
                    id,
                    serverId: 'test-server-id',
                    title: id,
                    type: ViewType.TAB,
                    isDisabled: false,
                })),
            }));

            const result = tabManager.getOrderedTabsForServer('test-server-id');
            expect(result).toHaveLength(3);
            expect(result[0].id).toBe('tab1');
            expect(result[1].id).toBe('tab2');
            expect(result[2].id).toBe('tab3');
        });

        it('should mark all tabs as disabled for logged out servers except primary view', () => {
            const tabIds = ['tab1', 'tab2', 'tab3'];
            tabManager.tabOrder.set('test-server-id', tabIds);

            ViewManager.getView.mockImplementation((id) => ({
                id,
                serverId: 'test-server-id',
                title: id,
                type: ViewType.TAB,
                toUniqueView: jest.fn(() => ({
                    id,
                    serverId: 'test-server-id',
                    title: id,
                    type: ViewType.TAB,
                })),
            }));
            ViewManager.isPrimaryView.mockImplementation((id) => id === 'tab1');
            ServerManager.getServer.mockReturnValue({...mockServer, isLoggedIn: false});

            const result = tabManager.getOrderedTabsForServer('test-server-id');
            expect(result[0].isDisabled).toBe(false);
            expect(result[1].isDisabled).toBe(true);
            expect(result[2].isDisabled).toBe(true);
        });
    });

    describe('getCurrentTabForServer', () => {
        const tabManager = new TabManager();
        it('should return undefined for server with no active tab', () => {
            const result = tabManager.getCurrentTabForServer('non-existent-server');
            expect(result).toBeUndefined();
        });

        it('should return the active tab view', () => {
            tabManager.activeTabs.set('test-server-id', 'test-view-id');
            ViewManager.getView.mockReturnValue(mockView);

            const result = tabManager.getCurrentTabForServer('test-server-id');
            expect(result).toBe(mockView);
        });
    });

    describe('getCurrentActiveTab', () => {
        const tabManager = new TabManager();
        it('should return undefined when no current server', () => {
            ServerManager.getCurrentServerId.mockReturnValue(null);

            const result = tabManager.getCurrentActiveTab();
            expect(result).toBeUndefined();
        });

        it('should return current active tab for current server', () => {
            tabManager.activeTabs.set('test-server-id', 'test-view-id');
            ViewManager.getView.mockReturnValue(mockView);

            const result = tabManager.getCurrentActiveTab();
            expect(result).toBe(mockView);
        });
    });

    describe('getCurrentActiveTabView', () => {
        const tabManager = new TabManager();
        it('should return undefined when no current active tab', () => {
            const result = tabManager.getCurrentActiveTabView();
            expect(result).toBeUndefined();
        });

        it('should return web contents view for current active tab', () => {
            tabManager.activeTabs.set('test-server-id', 'test-view-id');
            ViewManager.getView.mockReturnValue(mockView);
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);

            const result = tabManager.getCurrentActiveTabView();
            expect(result).toBe(mockWebContentsView);
        });
    });

    describe('updateTabOrder', () => {
        const tabManager = new TabManager();
        it('should update tab order and emit event', () => {
            const emitSpy = jest.spyOn(tabManager, 'emit');
            const viewIds = ['tab1', 'tab2', 'tab3'];

            tabManager.updateTabOrder('test-server-id', viewIds);

            expect(tabManager.tabOrder.get('test-server-id')).toEqual(viewIds);
            expect(emitSpy).toHaveBeenCalledWith(TAB_ORDER_UPDATED, 'test-server-id', viewIds);
        });
    });

    describe('focusCurrentTab', () => {
        const tabManager = new TabManager();
        it('should focus modal when modal is displayed', () => {
            ModalManager.isModalDisplayed.mockReturnValue(true);

            tabManager.focusCurrentTab();

            expect(ModalManager.focusCurrentModal).toHaveBeenCalled();
            expect(mockWebContentsView.focus).not.toHaveBeenCalled();
        });

        it('should focus current tab when no modal is displayed', () => {
            ModalManager.isModalDisplayed.mockReturnValue(false);
            tabManager.activeTabs.set('test-server-id', 'test-view-id');
            ViewManager.getView.mockReturnValue(mockView);
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);

            tabManager.focusCurrentTab();

            expect(mockWebContentsView.focus).toHaveBeenCalled();
        });
    });

    describe('switchToTab', () => {
        const tabManager = new TabManager();
        it('should not switch if tab is already active', () => {
            const mockView = {
                id: 'test-view',
                serverId: 'test-server',
                isErrored: jest.fn(() => false),
                getWebContentsView: jest.fn().mockImplementation(() => ({
                    webContents: {
                        focus: jest.fn(),
                    },
                    setBounds: jest.fn(),
                })),
                needsLoadingScreen: jest.fn(() => false),
            };
            ServerManager.getCurrentServerId.mockReturnValue('test-server');
            WebContentsManager.getView.mockReturnValue(mockView);
            tabManager.activeTabs.set('test-server', 'test-view');

            tabManager.switchToTab('test-view');

            expect(MainWindow.get).not.toHaveBeenCalled();
        });

        it('should not switch if tab is not a tab', () => {
            const mockView = {
                id: 'test-view',
                serverId: 'test-server',
                type: ViewType.WINDOW,
            };
            ServerManager.getCurrentServerId.mockReturnValue('test-server');
            WebContentsManager.getView.mockReturnValue(mockView);
            tabManager.activeTabs.set('test-server', 'test-view');
            const setActiveTabSpy = jest.spyOn(tabManager, 'setActiveTab');

            tabManager.switchToTab('test-view');
            expect(setActiveTabSpy).not.toHaveBeenCalled();
        });

        it('should switch to tab and show it', () => {
            const mockWebContentsView = {
                webContents: {focus: jest.fn()},
                setBounds: jest.fn(),
            };
            const mockView = {
                id: 'test-view',
                serverId: 'test-server',
                isErrored: jest.fn(() => false),
                needsLoadingScreen: jest.fn(() => false),
                getWebContentsView: jest.fn(() => mockWebContentsView),
                focus: jest.fn(),
            };
            WebContentsManager.getView.mockReturnValue(mockView);
            tabManager.activeTabs.set('test-server', 'other-view');

            tabManager.switchToTab('test-view');

            expect(MainWindow.get).toHaveBeenCalled();
            expect(mockMainWindow.contentView.addChildView).toHaveBeenCalledWith(mockWebContentsView);
            expect(tabManager.activeTabs.get('test-server')).toBe('test-view');
        });

        it('should not show tab if it is in error state', () => {
            const mockView = {
                id: 'test-view',
                serverId: 'test-server',
                isErrored: jest.fn(() => true),
                getWebContentsView: jest.fn(),
                focus: jest.fn(),
            };
            WebContentsManager.getView.mockReturnValue(mockView);

            tabManager.switchToTab('test-view');

            expect(mockMainWindow.contentView.addChildView).not.toHaveBeenCalled();
            expect(MainWindow.window.fadeLoadingScreen).toHaveBeenCalled();
        });

        it('should show loading screen if tab needs it', () => {
            const mockWebContentsView = {
                webContents: {focus: jest.fn()},
                setBounds: jest.fn(),
            };
            const mockView = {
                id: 'test-view',
                serverId: 'test-server',
                isErrored: jest.fn(() => false),
                needsLoadingScreen: jest.fn(() => true),
                getWebContentsView: jest.fn(() => mockWebContentsView),
                focus: jest.fn(),
            };
            WebContentsManager.getView.mockReturnValue(mockView);
            MainWindow.get.mockReturnValue(mockMainWindow);
            tabManager.activeTabs.set('test-server', 'other-view');

            tabManager.switchToTab('test-view');

            expect(MainWindow.window.showLoadingScreen).toHaveBeenCalled();
        });
    });

    describe('reloadCurrentTab', () => {
        const tabManager = new TabManager();
        it('should reload current tab', () => {
            tabManager.activeTabs.set('test-server-id', 'test-view-id');
            ViewManager.getView.mockReturnValue(mockView);
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);

            tabManager.reloadCurrentTab();

            expect(mockWebContentsView.reload).toHaveBeenCalledWith('https://test.com');
        });
    });

    describe('switchToNextTab and switchToPreviousTab', () => {
        const tabManager = new TabManager();
        beforeEach(() => {
            const tabIds = ['tab1', 'tab2', 'tab3'];
            tabManager.tabOrder.set('test-server-id', tabIds);
            tabManager.activeTabs.set('test-server-id', 'tab2');

            ViewManager.getView.mockImplementation((id) => ({
                id,
                serverId: 'test-server-id',
                title: `Tab ${id}`,
                type: ViewType.TAB,
                toUniqueView: jest.fn(() => ({
                    id,
                    serverId: 'test-server-id',
                    title: `Tab ${id}`,
                    type: ViewType.TAB,
                })),
            }));
        });

        it('should switch to next tab', () => {
            const switchToTabSpy = jest.spyOn(tabManager, 'switchToTab');

            tabManager.switchToNextTab();

            expect(switchToTabSpy).toHaveBeenCalledWith('tab3');
        });

        it('should switch to previous tab', () => {
            const switchToTabSpy = jest.spyOn(tabManager, 'switchToTab');

            tabManager.switchToPreviousTab();

            expect(switchToTabSpy).toHaveBeenCalledWith('tab1');
        });

        it('should wrap around to first tab when at last tab', () => {
            tabManager.activeTabs.set('test-server-id', 'tab3');
            const switchToTabSpy = jest.spyOn(tabManager, 'switchToTab');

            tabManager.switchToNextTab();

            expect(switchToTabSpy).toHaveBeenCalledWith('tab1');
        });

        it('should wrap around to last tab when at first tab', () => {
            tabManager.activeTabs.set('test-server-id', 'tab1');
            const switchToTabSpy = jest.spyOn(tabManager, 'switchToTab');

            tabManager.switchToPreviousTab();

            expect(switchToTabSpy).toHaveBeenCalledWith('tab3');
        });
    });

    describe('handleViewCreated', () => {
        it('should handle tab view creation', () => {
            const tabManager = new TabManager();
            const emitSpy = jest.spyOn(tabManager, 'emit');
            const mockTabView = {
                id: 'new-tab-id',
                serverId: 'test-server-id',
                type: ViewType.TAB,
            };

            ViewManager.getView.mockReturnValue(mockTabView);
            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');

            ViewManager.mockViewManager.emit(VIEW_CREATED, 'new-tab-id');

            expect(WebContentsManager.createView).toHaveBeenCalledWith(mockTabView, MainWindow.window);
            expect(emitSpy).toHaveBeenCalledWith(TAB_ADDED, 'test-server-id', 'new-tab-id');
        });

        it('should set first tab as active for current server', () => {
            const tabManager = new TabManager();
            tabManager.tabOrder.clear();
            tabManager.activeTabs.clear();
            const mockTabView = {
                id: 'new-tab-id',
                serverId: 'test-server-id',
                type: ViewType.TAB,
            };

            ViewManager.getView.mockReturnValue(mockTabView);
            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');

            ViewManager.mockViewManager.emit(VIEW_CREATED, 'new-tab-id');

            expect(tabManager.activeTabs.get('test-server-id')).toBe('new-tab-id');
        });

        it('should set first tab as active for its own server', () => {
            const tabManager = new TabManager();
            const mockTabView = {
                id: 'new-tab-id',
                serverId: 'other-server-id',
                type: ViewType.TAB,
            };

            ViewManager.getView.mockReturnValue(mockTabView);
            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');

            ViewManager.mockViewManager.emit(VIEW_CREATED, 'new-tab-id');

            expect(tabManager.activeTabs.get('other-server-id')).toBe('new-tab-id');
            expect(tabManager.activeTabs.get('test-server-id')).toBeUndefined();
        });
    });

    describe('handleViewRemoved', () => {
        it('should handle tab view removal', () => {
            const tabManager = new TabManager();
            const emitSpy = jest.spyOn(tabManager, 'emit');
            const tabIds = ['tab1', 'tab2', 'tab3'];
            tabManager.tabOrder.set('test-server-id', tabIds);

            ViewManager.mockViewManager.emit(VIEW_REMOVED, 'tab2', 'test-server-id');

            expect(WebContentsManager.removeView).toHaveBeenCalledWith('tab2');
            expect(tabManager.tabOrder.get('test-server-id')).toEqual(['tab1', 'tab3']);
            expect(emitSpy).toHaveBeenCalledWith(TAB_REMOVED, 'test-server-id', 'tab2');
        });

        it('should switch to another tab if the current active tab is removed', () => {
            const tabManager = new TabManager();
            const emitSpy = jest.spyOn(tabManager, 'emit');
            const tabIds = ['tab1', 'tab2', 'tab3'];
            tabManager.tabOrder.set('test-server-id', tabIds);
            tabManager.activeTabs.set('test-server-id', 'tab2');

            ViewManager.getView.mockImplementation((id) => {
                return {
                    id,
                    serverId: 'test-server-id',
                    type: ViewType.TAB,
                };
            });
            ViewManager.mockViewManager.emit(VIEW_REMOVED, 'tab1', 'test-server-id');

            expect(tabManager.activeTabs.get('test-server-id')).toBe('tab2');
            expect(tabManager.tabOrder.get('test-server-id')).toEqual(['tab2', 'tab3']);
            expect(emitSpy).toHaveBeenCalledWith(TAB_REMOVED, 'test-server-id', 'tab1');
        });
    });

    describe('handleViewUpdated', () => {
        it('should update tab title', () => {
            const mockTabView = {
                id: 'test-view-id',
                serverId: 'test-server-id',
                title: 'Updated Title',
                type: ViewType.TAB,
            };

            ViewManager.getView.mockReturnValue(mockTabView);

            ViewManager.mockViewManager.emit(VIEW_TITLE_UPDATED, 'test-view-id');

            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
                UPDATE_TAB_TITLE,
                'test-view-id',
                'Updated Title',
            );
        });
    });

    describe('handleServerCurrentChanged', () => {
        it('should switch to current tab for new server', () => {
            const tabManager = new TabManager();
            const mockTabView = {
                id: 'test-view-id',
                serverId: 'new-server-id',
                type: ViewType.TAB,
            };

            tabManager.activeTabs.set('new-server-id', 'test-view-id');
            ViewManager.getView.mockReturnValue(mockTabView);

            ServerManager.mockServerManager.emit(SERVER_SWITCHED, 'new-server-id');

            expect(tabManager.activeTabs.get('new-server-id')).toBe('test-view-id');
        });
    });

    describe('handleServerLoggedInChanged', () => {
        it('should handle server logout', () => {
            const tabManager = new TabManager();
            const mockPrimaryView = {
                id: 'primary-view-id',
                serverId: 'test-server-id',
                type: ViewType.TAB,
            };

            const mockOtherView = {
                id: 'other-tab-id',
                serverId: 'test-server-id',
                type: ViewType.TAB,
                toUniqueView: jest.fn(() => ({
                    id: 'other-tab-id',
                    serverId: 'test-server-id',
                    type: ViewType.TAB,
                })),
            };

            ViewManager.getPrimaryView.mockReturnValue(mockPrimaryView);
            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);
            ViewManager.getView.mockImplementation((id) => {
                if (id === 'other-tab-id') {
                    return mockOtherView;
                }
                return mockView;
            });

            const tabIds = ['primary-view-id', 'other-tab-id'];
            tabManager.tabOrder.set('test-server-id', tabIds);
            tabManager.activeTabs.set('test-server-id', 'other-tab-id');

            ServerManager.mockServerManager.emit(SERVER_LOGGED_IN_CHANGED, 'test-server-id', false);

            expect(tabManager.activeTabs.get('test-server-id')).toBe('primary-view-id');
            expect(ViewManager.removeView).toHaveBeenCalledWith('other-tab-id');
        });
    });

    describe('handleCreateNewTab', () => {
        it('should create new tab for valid server', () => {
            const mockNewView = {
                id: 'new-tab-id',
                serverId: 'test-server-id',
                type: ViewType.TAB,
            };

            ServerManager.getServer.mockReturnValue(mockServer);
            ViewManager.createView.mockReturnValue(mockNewView);

            const handlers = ipcMain.listeners(CREATE_NEW_TAB);
            const result = handlers[0]({}, 'test-server-id');

            expect(ViewManager.createView).toHaveBeenCalledWith(mockServer, ViewType.TAB);
            expect(result).toBe('new-tab-id');
        });

        it('should return undefined for invalid server', () => {
            ServerManager.getServer.mockReturnValue(null);

            const handlers = ipcMain.listeners(CREATE_NEW_TAB);
            const result = handlers[0]({}, 'invalid-server-id');

            expect(result).toBeUndefined();
        });
    });

    describe('handleCloseTab', () => {
        it('should close active tab and switch to next available tab', () => {
            const tabManager = new TabManager();
            const tabIds = ['tab1', 'tab2', 'tab3'];
            tabManager.tabOrder.set('test-server-id', tabIds);
            tabManager.activeTabs.set('test-server-id', 'tab2');

            const mockTabView = {
                id: 'tab2',
                serverId: 'test-server-id',
                type: ViewType.TAB,
            };

            ViewManager.getView.mockReturnValue(mockTabView);

            const handlers = ipcMain.listeners(CLOSE_TAB);
            handlers[0]({}, 'tab2');

            expect(ViewManager.removeView).toHaveBeenCalledWith('tab2');
        });

        it('should close non-active tab without switching', () => {
            const tabManager = new TabManager();
            const tabIds = ['tab1', 'tab2', 'tab3'];
            tabManager.tabOrder.set('test-server-id', tabIds);
            tabManager.activeTabs.set('test-server-id', 'tab1');

            const handlers = ipcMain.listeners(CLOSE_TAB);
            handlers[0]({}, 'tab2');

            expect(ViewManager.removeView).toHaveBeenCalledWith('tab2');
        });
    });

    describe('IPC handlers', () => {
        it('should handle UPDATE_TAB_ORDER', () => {
            const tabManager = new TabManager();
            const updateTabOrderSpy = jest.spyOn(tabManager, 'updateTabOrder');
            const viewOrder = ['tab1', 'tab2', 'tab3'];

            ipcMain.emit(UPDATE_TAB_ORDER, {}, 'test-server-id', viewOrder);

            expect(updateTabOrderSpy).toHaveBeenCalledWith('test-server-id', viewOrder);
        });

        it('should handle SWITCH_TAB', () => {
            const tabManager = new TabManager();
            const switchToTabSpy = jest.spyOn(tabManager, 'switchToTab');

            ipcMain.emit(SWITCH_TAB, {}, 'test-view-id');

            expect(switchToTabSpy).toHaveBeenCalledWith('test-view-id');
        });
    });

    describe('Event emission', () => {
        it('should emit ACTIVE_TAB_CHANGED when switching tabs', () => {
            const tabManager = new TabManager();
            const emitSpy = jest.spyOn(tabManager, 'emit');
            tabManager.activeTabs.set('test-server-id', 'other-view-id');
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);

            tabManager.switchToTab('test-view-id');
            expect(emitSpy).toHaveBeenCalledWith(ACTIVE_TAB_CHANGED, 'test-server-id', 'test-view-id');
        });
    });

    describe('removeCurrentVisibleTab', () => {
        it('should remove current visible tab from window', () => {
            const tabManager = new TabManager();
            const mockView = {
                id: 'test-view',
                getWebContentsView: jest.fn(() => ({})),
            };
            WebContentsManager.getView.mockReturnValue(mockView);
            MainWindow.get.mockReturnValue(mockMainWindow);
            tabManager.currentVisibleTab = 'test-view';

            tabManager.removeCurrentVisibleTab();

            expect(mockMainWindow.contentView.removeChildView).toHaveBeenCalledWith(mockView.getWebContentsView());
            expect(tabManager.currentVisibleTab).toBeUndefined();
        });

        it('should do nothing if no current visible tab', () => {
            const tabManager = new TabManager();
            MainWindow.get.mockReturnValue(mockMainWindow);
            tabManager.currentVisibleTab = undefined;

            tabManager.removeCurrentVisibleTab();

            expect(mockMainWindow.contentView.removeChildView).not.toHaveBeenCalled();
        });
    });

    describe('handleViewTypeRemoved', () => {
        it('should handle TAB type removal correctly', () => {
            const tabManager = new TabManager();
            const emitSpy = jest.spyOn(tabManager, 'emit');
            const switchToNextTabSpy = jest.spyOn(tabManager, 'switchToNextTabIfNecessary').mockImplementation(() => {});
            const webContentsView = {
                webContents: {focus: jest.fn()},
                setBounds: jest.fn(),
            };
            const mockWebContentsView = {
                getWebContentsView: jest.fn(() => webContentsView),
            };

            // Set up initial state
            const tabIds = ['tab1', 'test-tab-id', 'tab3'];
            tabManager.tabOrder.set('test-server-id', tabIds);
            tabManager.activeTabs.set('test-server-id', 'test-tab-id');

            // Clear the global mock and set up test-specific mock
            ViewManager.getView.mockReset();
            ViewManager.getView.mockImplementation((id) => {
                if (id === null || id === undefined) {
                    return null;
                }
                return {
                    id,
                    serverId: 'test-server-id',
                    type: ViewType.TAB,
                    isErrored: jest.fn(() => false),
                };
            });
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);
            MainWindow.get.mockReturnValue(mockMainWindow);

            // Emit the event
            ViewManager.mockViewManager.emit(VIEW_TYPE_REMOVED, 'test-tab-id', ViewType.TAB);

            // Verify the tab was removed from order
            expect(tabManager.tabOrder.get('test-server-id')).toEqual(['tab1', 'tab3']);

            // Verify the web contents view was removed from main window
            expect(mockMainWindow.contentView.removeChildView).toHaveBeenCalledWith(webContentsView);

            // Verify TAB_REMOVED event was emitted
            expect(emitSpy).toHaveBeenCalledWith(TAB_REMOVED, 'test-server-id', 'test-tab-id');

            // Verify switchToNextTabIfNecessary was called
            expect(switchToNextTabSpy).toHaveBeenCalledWith('test-tab-id');
        });

        it('should not handle non-TAB type removal', () => {
            const tabManager = new TabManager();
            const mockView = {
                id: 'test-window-id',
                serverId: 'test-server-id',
                type: ViewType.WINDOW,
            };

            ViewManager.getView.mockReturnValue(mockView);

            // Emit the event for WINDOW type
            ViewManager.mockViewManager.emit(VIEW_TYPE_REMOVED, 'test-window-id', ViewType.WINDOW);

            // Verify no tab-related actions were taken
            expect(tabManager.tabOrder.get('test-server-id')).toBeUndefined();
            expect(mockMainWindow.contentView.removeChildView).not.toHaveBeenCalled();
        });

        it('should handle removal when view does not exist', () => {
            const tabManager = new TabManager();

            ViewManager.getView.mockReturnValue(null);

            // Emit the event for non-existent view
            ViewManager.mockViewManager.emit(VIEW_TYPE_REMOVED, 'non-existent-id', ViewType.TAB);

            // Verify no errors occurred and no actions were taken
            expect(tabManager.tabOrder.get('test-server-id')).toBeUndefined();
            expect(mockMainWindow.contentView.removeChildView).not.toHaveBeenCalled();
        });

        it('should switch to next tab if current active tab is removed', () => {
            const tabManager = new TabManager();
            const switchToNextTabSpy = jest.spyOn(tabManager, 'switchToNextTabIfNecessary').mockImplementation(() => {});
            const mockWebContentsView = {
                getWebContentsView: jest.fn(() => ({
                    webContents: {focus: jest.fn()},
                    setBounds: jest.fn(),
                })),
                isErrored: jest.fn(() => false),
                focus: jest.fn(),
                setBounds: jest.fn(),
                needsLoadingScreen: jest.fn(() => false),
            };

            // Set up initial state with current tab as active
            const tabIds = ['tab1', 'current-tab-id', 'tab3'];
            tabManager.tabOrder.set('test-server-id', tabIds);
            tabManager.activeTabs.set('test-server-id', 'current-tab-id');

            // Clear the global mock and set up test-specific mock
            ViewManager.getView.mockReset();
            ViewManager.getView.mockImplementation((id) => {
                if (id === null || id === undefined) {
                    return null;
                }
                return {
                    id,
                    serverId: 'test-server-id',
                    type: ViewType.TAB,
                    isErrored: jest.fn(() => false),
                };
            });
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);
            MainWindow.get.mockReturnValue(mockMainWindow);

            // Emit the event
            ViewManager.mockViewManager.emit(VIEW_TYPE_REMOVED, 'current-tab-id', ViewType.TAB);

            // Verify the active tab was switched to the next available tab
            expect(tabManager.activeTabs.get('test-server-id')).toBe('current-tab-id');

            // Verify switchToNextTabIfNecessary was called
            expect(switchToNextTabSpy).toHaveBeenCalledWith('current-tab-id');
        });

        it('should clean up tab listeners when removing tab', () => {
            const tabManager = new TabManager();
            const switchToNextTabSpy = jest.spyOn(tabManager, 'switchToNextTabIfNecessary').mockImplementation(() => {});
            const mockWebContentsView = {
                getWebContentsView: jest.fn(() => ({
                    webContents: {focus: jest.fn()},
                })),
            };
            const mockCleanupFunction = jest.fn();

            // Set up a tab listener
            tabManager.tabListeners.set('test-tab-id', mockCleanupFunction);

            // Clear the global mock and set up test-specific mock
            ViewManager.getView.mockReset();
            ViewManager.getView.mockImplementation((id) => {
                if (id === null || id === undefined) {
                    return null;
                }
                return {
                    id,
                    serverId: 'test-server-id',
                    type: ViewType.TAB,
                    isErrored: jest.fn(() => false),
                };
            });
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);
            MainWindow.get.mockReturnValue(mockMainWindow);

            // Emit the event
            ViewManager.mockViewManager.emit(VIEW_TYPE_REMOVED, 'test-tab-id', ViewType.TAB);

            // Verify the cleanup function was called and listener was removed
            expect(mockCleanupFunction).toHaveBeenCalled();
            expect(tabManager.tabListeners.has('test-tab-id')).toBe(false);

            // Verify switchToNextTabIfNecessary was called
            expect(switchToNextTabSpy).toHaveBeenCalledWith('test-tab-id');
        });
    });

    describe('handleViewTypeAdded', () => {
        it('should handle TAB type addition correctly', () => {
            const tabManager = new TabManager();
            const emitSpy = jest.spyOn(tabManager, 'emit');
            const switchToTabSpy = jest.spyOn(tabManager, 'switchToTab');
            const mockWebContentsView = {
                updateParentWindow: jest.fn(),
                on: jest.fn(),
                id: 'new-tab-id',
                isErrored: jest.fn(() => false),
                getWebContentsView: jest.fn(() => ({
                    webContents: {focus: jest.fn(), on: jest.fn()},
                    setBounds: jest.fn(),
                })),
                focus: jest.fn(),
                setBounds: jest.fn(),
                needsLoadingScreen: jest.fn(() => false),
            };

            // Clear the global mock and set up test-specific mock
            ViewManager.getView.mockReset();
            ViewManager.getView.mockImplementation((id) => {
                if (id === null || id === undefined) {
                    return null;
                }
                return {
                    id,
                    serverId: 'test-server-id',
                    type: ViewType.TAB,
                    isErrored: jest.fn(() => false),
                };
            });
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);
            MainWindow.window = mockMainWindow;

            // Emit the event
            ViewManager.mockViewManager.emit(VIEW_TYPE_ADDED, 'new-tab-id', ViewType.TAB);

            // Verify the web contents view was updated with main window
            expect(mockWebContentsView.updateParentWindow).toHaveBeenCalledWith(mockMainWindow.browserWindow);

            // Verify the tab was set up
            expect(tabManager.tabOrder.get('test-server-id')).toContain('new-tab-id');

            // Verify TAB_ADDED event was emitted
            expect(emitSpy).toHaveBeenCalledWith(TAB_ADDED, 'test-server-id', 'new-tab-id');

            // Verify switchToTab was called
            expect(switchToTabSpy).toHaveBeenCalledWith('new-tab-id');
        });

        it('should not handle non-TAB type addition', () => {
            const tabManager = new TabManager();
            const emitSpy = jest.spyOn(tabManager, 'emit');
            const mockView = {
                id: 'new-window-id',
                serverId: 'test-server-id',
                type: ViewType.WINDOW,
            };

            ViewManager.getView.mockReturnValue(mockView);

            // Emit the event for WINDOW type
            ViewManager.mockViewManager.emit(VIEW_TYPE_ADDED, 'new-window-id', ViewType.WINDOW);

            // Verify no tab-related actions were taken
            expect(tabManager.tabOrder.get('test-server-id')).toBeUndefined();
            expect(emitSpy).not.toHaveBeenCalledWith(TAB_ADDED, expect.any(String), expect.any(String));
        });

        it('should handle addition when view does not exist', () => {
            const tabManager = new TabManager();
            const emitSpy = jest.spyOn(tabManager, 'emit');

            ViewManager.getView.mockReturnValue(null);

            // Emit the event for non-existent view
            ViewManager.mockViewManager.emit(VIEW_TYPE_ADDED, 'non-existent-id', ViewType.TAB);

            // Verify no errors occurred and no actions were taken
            expect(tabManager.tabOrder.get('test-server-id')).toBeUndefined();
            expect(emitSpy).not.toHaveBeenCalledWith(TAB_ADDED, expect.any(String), expect.any(String));
        });

        it('should handle addition when web contents view does not exist', () => {
            const tabManager = new TabManager();
            const emitSpy = jest.spyOn(tabManager, 'emit');

            // Clear the global mock and set up test-specific mock
            ViewManager.getView.mockReset();
            ViewManager.getView.mockImplementation((id) => {
                if (id === null || id === undefined) {
                    return null;
                }
                return {
                    id,
                    serverId: 'test-server-id',
                    type: ViewType.TAB,
                    isErrored: jest.fn(() => false),
                };
            });
            WebContentsManager.getView.mockReturnValue(null);

            // Emit the event
            ViewManager.mockViewManager.emit(VIEW_TYPE_ADDED, 'new-tab-id', ViewType.TAB);

            // Verify no errors occurred and no actions were taken
            expect(tabManager.tabOrder.get('test-server-id')).toBeUndefined();
            expect(emitSpy).not.toHaveBeenCalledWith(TAB_ADDED, expect.any(String), expect.any(String));
        });

        it('should switch to the new tab when added', () => {
            const tabManager = new TabManager();
            const switchToTabSpy = jest.spyOn(tabManager, 'switchToTab');
            const mockWebContentsView = {
                updateParentWindow: jest.fn(),
                on: jest.fn(),
                id: 'new-tab-id',
                isErrored: jest.fn(() => false),
                getWebContentsView: jest.fn(() => ({
                    webContents: {focus: jest.fn(), on: jest.fn()},
                    setBounds: jest.fn(),
                })),
                focus: jest.fn(),
                setBounds: jest.fn(),
                needsLoadingScreen: jest.fn(() => false),
            };

            // Clear the global mock and set up test-specific mock
            ServerManager.getCurrentServerId.mockReturnValue('test-server-id');
            ViewManager.getView.mockReset();
            ViewManager.getView.mockImplementation((id) => {
                if (id === null || id === undefined) {
                    return null;
                }
                return {
                    id,
                    serverId: 'test-server-id',
                    type: ViewType.TAB,
                    isErrored: jest.fn(() => false),
                };
            });
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);
            MainWindow.window = mockMainWindow;

            // Emit the event
            ViewManager.mockViewManager.emit(VIEW_TYPE_ADDED, 'new-tab-id', ViewType.TAB);

            // Verify switchToTab was called
            expect(switchToTabSpy).toHaveBeenCalledWith('new-tab-id');
        });

        it('should set up tab listeners when adding tab', () => {
            const tabManager = new TabManager();
            const switchToTabSpy = jest.spyOn(tabManager, 'switchToTab');
            const mockWebContentsView = {
                updateParentWindow: jest.fn(),
                on: jest.fn(),
                id: 'new-tab-id',
                isErrored: jest.fn(() => false),
                getWebContentsView: jest.fn(() => ({
                    webContents: {focus: jest.fn(), on: jest.fn()},
                    setBounds: jest.fn(),
                })),
                focus: jest.fn(),
                setBounds: jest.fn(),
                needsLoadingScreen: jest.fn(() => false),
            };

            // Clear the global mock and set up test-specific mock
            ViewManager.getView.mockReset();
            ViewManager.getView.mockImplementation((id) => {
                if (id === null || id === undefined) {
                    return null;
                }
                return {
                    id,
                    serverId: 'test-server-id',
                    type: ViewType.TAB,
                    isErrored: jest.fn(() => false),
                };
            });
            WebContentsManager.getView.mockReturnValue(mockWebContentsView);
            MainWindow.window = mockMainWindow;

            // Emit the event
            ViewManager.mockViewManager.emit(VIEW_TYPE_ADDED, 'new-tab-id', ViewType.TAB);

            // Verify event listeners were set up
            expect(mockWebContentsView.on).toHaveBeenCalledWith(expect.any(String), expect.any(Function));

            // Verify a cleanup function was stored
            expect(tabManager.tabListeners.has('new-tab-id')).toBe(true);

            // Verify switchToTab was called
            expect(switchToTabSpy).toHaveBeenCalledWith('new-tab-id');
        });
    });
});
