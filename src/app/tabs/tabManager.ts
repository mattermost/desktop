// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';
import EventEmitter from 'events';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import type {MattermostWebContentsView} from 'app/views/MattermostWebContentsView';
import WebContentsManager from 'app/views/webContentsManager';
import {
    ACTIVE_TAB_CHANGED,
    TAB_ORDER_UPDATED,
    TAB_ADDED,
    TAB_REMOVED,
    VIEW_CREATED,
    VIEW_REMOVED,
    MAIN_WINDOW_RESIZED,
    MAIN_WINDOW_FOCUSED,
    LOADSCREEN_END,
    LOAD_FAILED,
    SERVER_SWITCHED,
    SET_ACTIVE_VIEW,
    GET_ORDERED_TABS_FOR_SERVER,
    GET_ACTIVE_TAB_FOR_SERVER,
    VIEW_TITLE_UPDATED,
    UPDATE_TAB_TITLE,
    CREATE_NEW_TAB,
    SWITCH_TAB,
    CLOSE_TAB,
    SERVER_LOGGED_IN_CHANGED,
    RELOAD_VIEW,
    UPDATE_TAB_ORDER,
    VIEW_TYPE_ADDED,
    VIEW_TYPE_REMOVED,
} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import type {MattermostView} from 'common/views/MattermostView';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {getAdjustedWindowBoundaries, getWindowBoundaries} from 'main/utils';

import type {UniqueView} from 'types/config';

const log = new Logger('TabManager');

export class TabManager extends EventEmitter {
    private activeTabs: Map<string, string>;
    private tabOrder: Map<string, string[]>;
    private currentVisibleTab?: string;
    private tabListeners: Map<string, () => void>;

    constructor() {
        super();
        this.activeTabs = new Map();
        this.tabOrder = new Map();
        this.tabListeners = new Map();

        MainWindow.on(MAIN_WINDOW_RESIZED, this.handleSetCurrentTabViewBounds);
        MainWindow.on(MAIN_WINDOW_FOCUSED, this.focusCurrentTab);

        ipcMain.handle(GET_ORDERED_TABS_FOR_SERVER, (event, serverId) => this.getOrderedTabsForServer(serverId));
        ipcMain.handle(GET_ACTIVE_TAB_FOR_SERVER, (event, serverId) => this.getCurrentTabForServer(serverId)?.toUniqueView());
        ipcMain.handle(CREATE_NEW_TAB, (event, serverId) => this.handleCreateNewTab(serverId));
        ipcMain.on(UPDATE_TAB_ORDER, (event, serverId, viewOrder) => this.updateTabOrder(serverId, viewOrder));
        ipcMain.on(SWITCH_TAB, (event, viewId) => this.switchToTab(viewId));
        ipcMain.on(CLOSE_TAB, (event, viewId) => this.handleCloseTab(viewId));

        // Subscribe to ViewManager events
        ViewManager.on(VIEW_CREATED, this.handleViewCreated);
        ViewManager.on(VIEW_REMOVED, this.handleViewRemoved);
        ViewManager.on(VIEW_TITLE_UPDATED, this.handleViewUpdated);
        ViewManager.on(VIEW_TYPE_REMOVED, this.handleViewTypeRemoved);
        ViewManager.on(VIEW_TYPE_ADDED, this.handleViewTypeAdded);

        ServerManager.on(SERVER_SWITCHED, this.handleServerCurrentChanged);
        ServerManager.on(SERVER_LOGGED_IN_CHANGED, this.handleServerLoggedInChanged);
    }

    getOrderedTabsForServer = (serverId: string): UniqueView[] => {
        const order = this.tabOrder.get(serverId) || [];
        return order.map((tabId) => {
            // Forcing this makes the type checker happy
            const view = ViewManager.getView(tabId)!;
            return {
                ...view.toUniqueView(),
                isDisabled: !ServerManager.getServer(view.serverId)?.isLoggedIn && !ViewManager.isPrimaryView(view.id),
            };
        }).filter((tab) => tab !== undefined);
    };

    getCurrentTabForServer = (serverId: string) => {
        const activeTabId = this.activeTabs.get(serverId);
        if (!activeTabId) {
            return undefined;
        }

        const view = ViewManager.getView(activeTabId);
        if (!view) {
            return undefined;
        }
        return view;
    };

    getCurrentActiveTab = () => {
        const serverId = ServerManager.getCurrentServerId();
        if (!serverId) {
            return undefined;
        }
        return this.getCurrentTabForServer(serverId);
    };

    getCurrentActiveTabView = () => {
        const tab = this.getCurrentActiveTab();
        if (!tab) {
            return undefined;
        }
        return WebContentsManager.getView(tab.id);
    };

    isActiveTab = (viewId: string) => {
        const serverId = ServerManager.getCurrentServerId();
        if (!serverId) {
            return false;
        }
        return this.activeTabs.get(serverId) === viewId;
    };

    updateTabOrder = (serverId: string, viewIds: string[]) => {
        log.debug('updateTabOrder', serverId, viewIds);

        if (viewIds.length === 0) {
            this.tabOrder.delete(serverId);
        } else {
            this.tabOrder.set(serverId, viewIds);
        }
        this.emit(TAB_ORDER_UPDATED, serverId, viewIds);
    };

    focusCurrentTab = () => {
        log.debug('focusCurrentTab');

        // If there is a modal open, focus that instead
        if (ModalManager.isModalDisplayed()) {
            ModalManager.focusCurrentModal();
            return;
        }

        const view = this.getCurrentActiveTabView();
        if (view) {
            view.focus();
        }
    };

    switchToTab = (viewId: string) => {
        log.debug('switchToTab', viewId);

        if (this.isActiveTab(viewId)) {
            log.silly(`switchToTab: Tab ${viewId} is already active, will not show`);
            return;
        }

        const view = ViewManager.getView(viewId);
        if (!view) {
            log.error(`switchToTab: Tab ${viewId} does not exist`);
            return;
        }

        if (view.type !== ViewType.TAB) {
            log.error(`switchToTab: Tab ${viewId} is not a tab, will not show`);
            return;
        }

        if (view.serverId !== ServerManager.getCurrentServerId()) {
            this.activeTabs.set(view.serverId, view.id);
            ServerManager.updateCurrentServer(view.serverId);
            return;
        }

        this.setActiveTab(viewId);
    };

    reloadCurrentTab = () => {
        const view = this.getCurrentActiveTabView();
        if (view) {
            view.reload(view.currentURL);
        }
    };

    switchToNextTab = () => {
        this.goToTabOffset(1);
    };

    switchToPreviousTab = () => {
        this.goToTabOffset(-1);
    };

    // Event handlers for ViewManager integration
    private handleViewCreated = (viewId: string) => {
        const view = ViewManager.getView(viewId);
        if (view && view.type === ViewType.TAB) {
            const mainWindow = MainWindow.window;
            if (!mainWindow) {
                log.error('handleViewCreated: No main window found');
                return;
            }

            const isFirstTab = !this.tabOrder.get(view.serverId)?.length;

            const webContentsView = WebContentsManager.createView(view, mainWindow);
            this.setupTab(view, webContentsView);

            // Set this tab as active if it's the first tab for the server
            if (isFirstTab) {
                if (view.serverId === ServerManager.getCurrentServerId()) {
                    this.setActiveTab(view.id);
                } else {
                    this.activeTabs.set(view.serverId, view.id);
                }
            }
        }
    };

    private setupTab = (view: MattermostView, webContentsView: MattermostWebContentsView) => {
        const mainWindow = MainWindow.window;
        if (!mainWindow) {
            log.error('setupListeners: No main window found');
            return;
        }

        webContentsView.on(LOADSCREEN_END, this.finishLoading);
        webContentsView.on(LOAD_FAILED, this.failLoading);
        webContentsView.on(RELOAD_VIEW, this.onReloadView);
        if (process.platform !== 'darwin') {
            // @ts-expect-error: The type is wrong on Electrons side
            webContentsView.getWebContentsView().webContents.on('before-input-event', mainWindow.handleAltKeyPressed);
        }

        this.tabListeners.set(webContentsView.id, () => {
            webContentsView.off(LOADSCREEN_END, this.finishLoading);
            webContentsView.off(LOAD_FAILED, this.failLoading);
            webContentsView.off(RELOAD_VIEW, this.onReloadView);

            // @ts-expect-error: The type is wrong on Electrons side
            webContentsView.getWebContentsView().webContents.off('before-input-event', mainWindow.handleAltKeyPressed);
        });

        this.updateTabOrder(view.serverId, [...this.tabOrder.get(view.serverId) || [], view.id]);
        this.emit(TAB_ADDED, view.serverId, view.id);
        mainWindow.sendToRenderer(TAB_ADDED, view.serverId, view.id);
    };

    private handleViewRemoved = (viewId: string, serverId: string) => {
        this.unregisterTab(viewId, serverId);
        WebContentsManager.removeView(viewId);
    };

    private unregisterTab = (viewId: string, serverId: string) => {
        const tabOrder = this.tabOrder.get(serverId);
        if (tabOrder) {
            this.updateTabOrder(serverId, tabOrder.filter((tab) => tab !== viewId));
        }

        this.emit(TAB_REMOVED, serverId, viewId);
        MainWindow.window?.sendToRenderer(TAB_REMOVED, serverId, viewId);

        this.tabListeners.get(viewId)?.();
        this.tabListeners.delete(viewId);
    };

    private handleViewTypeRemoved = (viewId: string, type: ViewType) => {
        if (type === ViewType.TAB) {
            const view = ViewManager.getView(viewId);
            if (view) {
                this.switchToNextTabIfNecessary(viewId);
                const webContentsView = WebContentsManager.getView(viewId);
                if (webContentsView) {
                    MainWindow.get()?.contentView.removeChildView(webContentsView.getWebContentsView());
                }
                this.unregisterTab(viewId, view.serverId);
            }
        }
    };

    private handleViewTypeAdded = (viewId: string, type: ViewType) => {
        if (type === ViewType.TAB) {
            const view = ViewManager.getView(viewId);
            const webContentsView = WebContentsManager.getView(viewId);
            if (view && webContentsView) {
                const mainWindow = MainWindow.window;
                if (mainWindow) {
                    webContentsView.updateParentWindow(mainWindow.browserWindow);
                }
                this.setupTab(view, webContentsView);
                this.switchToTab(viewId);
            }
        }
    };

    private handleViewUpdated = (viewId: string) => {
        log.debug('handleViewUpdated', viewId);

        const view = ViewManager.getView(viewId);
        if (view && view.type === ViewType.TAB) {
            MainWindow.get()?.webContents.send(UPDATE_TAB_TITLE, view.id, view.title);
        }
    };

    private handleSetCurrentTabViewBounds = (newBounds: Electron.Rectangle) => {
        log.silly('handleSetCurrentViewBounds', newBounds);

        const currentView = this.getCurrentActiveTabView();
        if (currentView && currentView.currentURL) {
            const adjustedBounds = getAdjustedWindowBoundaries(newBounds.width, newBounds.height);
            currentView.setBounds(adjustedBounds);
        }
    };

    private handleServerCurrentChanged = (serverId: string) => {
        log.debug('handleServerCurrentChanged', serverId);

        const tab = this.getCurrentTabForServer(serverId);
        if (tab) {
            this.setActiveTab(tab.id);
        }
    };

    private handleServerLoggedInChanged = (serverId: string, loggedIn: boolean) => {
        log.debug('handleServerLoggedInChanged', serverId, loggedIn);

        if (!loggedIn) {
            const view = ViewManager.getPrimaryView(serverId);
            if (view) {
                if (ServerManager.getCurrentServerId() === serverId) {
                    this.switchToTab(view.id);
                } else {
                    this.activeTabs.set(serverId, view.id);
                }

                // TODO: The flow I'd prefer is to save each tabs path and then reload them
                // But that's not easily feasible yet, so for now we just remove the tabs
                this.getOrderedTabsForServer(serverId).
                    filter((tab) => tab.id !== view.id).
                    forEach((tab) => ViewManager.removeView(tab.id));
            }
        }
    };

    private setActiveTab = (viewId: string) => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            log.warn('setActiveTab: No main window found');
            return;
        }
        const view = WebContentsManager.getView(viewId);
        if (!view) {
            log.warn(`setActiveTab: Web contents view for tab ${viewId} not found`);
            return;
        }

        mainWindow.webContents.send(SET_ACTIVE_VIEW, view.serverId, viewId);
        this.activeTabs.set(view.serverId, viewId);
        this.emit(ACTIVE_TAB_CHANGED, view.serverId, viewId);

        // If the tab is in error state, do not show the view, the error screen will be on the window instead
        if (view.isErrored()) {
            this.removeCurrentVisibleTab();
            MainWindow.window?.fadeLoadingScreen();
            log.verbose(`switchToTab: Tab ${viewId} is in error state, will not show`);
            return;
        }

        mainWindow.contentView.addChildView(view.getWebContentsView());
        view.focus();
        view.getWebContentsView().setBounds(getWindowBoundaries(mainWindow));
        this.removeCurrentVisibleTab();
        this.currentVisibleTab = viewId;

        if (view.needsLoadingScreen() && !ModalManager.isModalDisplayed()) {
            MainWindow.window?.showLoadingScreen();
        }
    };

    private removeCurrentVisibleTab = () => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            log.warn('removeCurrentVisibleTab: No main window found');
            return;
        }
        if (this.currentVisibleTab) {
            const view = WebContentsManager.getView(this.currentVisibleTab);
            if (view) {
                mainWindow.contentView.removeChildView(view.getWebContentsView());
            }
            this.currentVisibleTab = undefined;
        }
    };

    private finishLoading = (viewId: string) => {
        ViewManager.getViewLog(viewId, 'TabManager').debug('finishLoading');

        if (this.isActiveTab(viewId)) {
            MainWindow.window?.fadeLoadingScreen();
        }
    };

    private failLoading = (viewId: string) => {
        ViewManager.getViewLog(viewId, 'TabManager').debug('failLoading');

        if (this.isActiveTab(viewId)) {
            const view = WebContentsManager.getView(viewId);
            if (view) {
                MainWindow.get()?.contentView.removeChildView(view.getWebContentsView());
            }
            MainWindow.window?.fadeLoadingScreen();
        }
    };

    private handleCreateNewTab = (serverId: string) => {
        log.debug('handleCreateNewTab', serverId);

        const server = ServerManager.getServer(serverId);
        if (!server) {
            return undefined;
        }

        return ViewManager.createView(server, ViewType.TAB).id;
    };

    private handleCloseTab = (viewId: string) => {
        log.debug('handleCloseTab', viewId);

        this.switchToNextTabIfNecessary(viewId);
        ViewManager.removeView(viewId);
    };

    private switchToNextTabIfNecessary = (viewId: string) => {
        if (this.isActiveTab(viewId)) {
            const serverId = ViewManager.getView(viewId)?.serverId;
            if (!serverId) {
                log.error('handleCloseTab: No server ID found for tab', viewId);
                return;
            }

            const currentTabs = this.tabOrder.get(serverId);
            if (!currentTabs) {
                log.error('handleCloseTab: No tabs found for server', serverId);
                return;
            }

            const currentIndex = currentTabs.findIndex((tab) => tab === viewId);
            const nextTab = currentTabs[currentIndex - 1] || currentTabs[currentIndex + 1] || currentTabs[0];
            this.switchToTab(nextTab);
        }
    };

    private goToTabOffset = (offset: number) => {
        const currentTab = this.getCurrentActiveTab();
        if (currentTab) {
            const currentIndex = this.getOrderedTabsForServer(currentTab.serverId).findIndex((tab) => tab.id === currentTab.id);
            let nextIndex = (currentIndex + offset) % this.getOrderedTabsForServer(currentTab.serverId).length;
            if (nextIndex < 0) {
                nextIndex = this.getOrderedTabsForServer(currentTab.serverId).length - 1;
            }
            const nextTab = this.getOrderedTabsForServer(currentTab.serverId)[nextIndex];
            if (nextTab) {
                this.switchToTab(nextTab.id);
            }
        }
    };

    private onReloadView = () => {
        if (!ModalManager.isModalDisplayed()) {
            MainWindow.window?.showLoadingScreen();
        }
    };
}

// Export a singleton instance
const tabManager = new TabManager();
export default tabManager;
