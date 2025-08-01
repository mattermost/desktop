// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';
import EventEmitter from 'events';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import LoadingScreen from 'app/views/loadingScreen';
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
    VIEW_UPDATED,
    UPDATE_TAB_TITLE,
    CREATE_NEW_TAB,
    SWITCH_TAB,
    CLOSE_TAB,
    SERVER_LOGGED_IN_CHANGED,
} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {getAdjustedWindowBoundaries, getWindowBoundaries} from 'main/utils';

const log = new Logger('TabManager');

export interface TabInfo {
    id: string;
    title: string;
    isActive: boolean;
    order: number;
}

export class TabManager extends EventEmitter {
    private activeTabs: Map<string, string>;
    private tabOrder: Map<string, string[]>;
    private currentVisibleTab?: string;

    constructor() {
        super();
        this.activeTabs = new Map();
        this.tabOrder = new Map();

        MainWindow.on(MAIN_WINDOW_RESIZED, this.handleSetCurrentTabViewBounds);
        MainWindow.on(MAIN_WINDOW_FOCUSED, this.focusCurrentTab);

        ipcMain.handle(GET_ORDERED_TABS_FOR_SERVER, (event, serverId) => this.getOrderedTabsForServer(serverId));
        ipcMain.handle(GET_ACTIVE_TAB_FOR_SERVER, (event, serverId) => this.getCurrentTabForServer(serverId)?.toUniqueView());
        ipcMain.handle(CREATE_NEW_TAB, (event, serverId) => this.handleCreateNewTab(serverId));
        ipcMain.on(SWITCH_TAB, (event, viewId) => this.switchToTab(viewId));
        ipcMain.on(CLOSE_TAB, (event, viewId) => this.handleCloseTab(viewId));

        // Subscribe to ViewManager events
        ViewManager.on(VIEW_CREATED, this.handleViewCreated);
        ViewManager.on(VIEW_REMOVED, this.handleViewRemoved);
        ViewManager.on(VIEW_UPDATED, this.handleViewUpdated);

        ServerManager.on(SERVER_SWITCHED, this.handleServerCurrentChanged);
        ServerManager.on(SERVER_LOGGED_IN_CHANGED, this.handleServerLoggedInChanged);
    }

    getOrderedTabsForServer = (serverId: string) => {
        const order = this.tabOrder.get(serverId) || [];
        return order.map((tabId) => {
            const view = ViewManager.getView(tabId);
            if (!view) {
                return undefined;
            }
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

        this.tabOrder.set(serverId, viewIds);
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

        this.setActiveTab(viewId);
    };

    sendToFind = () => {
        const view = this.getCurrentActiveTabView();
        if (view) {
            view.openFind();
        }
    };

    reloadCurrentTab = () => {
        const view = this.getCurrentActiveTabView();
        if (view) {
            LoadingScreen.show();
            view.reload(view.currentURL);
        }
    };

    // Event handlers for ViewManager integration
    private handleViewCreated = (viewId: string) => {
        const view = ViewManager.getView(viewId);
        if (view && view.type === ViewType.TAB) {
            const webContentsView = WebContentsManager.createView(view);
            webContentsView.on(LOADSCREEN_END, this.finishLoading);
            webContentsView.on(LOAD_FAILED, this.failLoading);

            // Set this tab as active if it's the first tab for the server
            if (!this.tabOrder.get(view.serverId)?.length) {
                if (view.serverId === ServerManager.getCurrentServerId()) {
                    this.setActiveTab(view.id);
                } else {
                    this.activeTabs.set(view.serverId, view.id);
                }
            }

            this.updateTabOrder(view.serverId, [...this.tabOrder.get(view.serverId) || [], view.id]);
            this.emit(TAB_ADDED, view.serverId, view.id);
        }
    };

    private handleViewRemoved = (viewId: string) => {
        for (const [serverId, tabs] of this.tabOrder.entries()) {
            if (tabs.some((tab) => tab === viewId)) {
                WebContentsManager.removeView(viewId);

                this.updateTabOrder(serverId, tabs.filter((tab) => tab !== viewId));
                this.emit(TAB_REMOVED, serverId, viewId);
                break;
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

        mainWindow.webContents.send(SET_ACTIVE_VIEW, view.view.serverId, viewId);
        this.activeTabs.set(view.view.serverId, viewId);
        this.emit(ACTIVE_TAB_CHANGED, view.view.serverId, viewId);

        // If the tab is in error state, do not show the view, the error screen will be on the window instead
        if (view.isErrored()) {
            this.removeCurrentVisibleTab();
            LoadingScreen.fade();
            log.verbose(`switchToTab: Tab ${viewId} is in error state, will not show`);
            return;
        }

        mainWindow.contentView.addChildView(view.getWebContentsView());
        view.getWebContentsView().setBounds(getWindowBoundaries(mainWindow));
        this.removeCurrentVisibleTab();
        this.currentVisibleTab = viewId;

        if (view.needsLoadingScreen()) {
            LoadingScreen.show();
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
            LoadingScreen.fade();
        }
    };

    private failLoading = (viewId: string) => {
        ViewManager.getViewLog(viewId, 'TabManager').debug('failLoading');

        if (this.isActiveTab(viewId)) {
            const view = WebContentsManager.getView(viewId);
            if (view) {
                MainWindow.get()?.contentView.removeChildView(view.getWebContentsView());
            }
            LoadingScreen.fade();
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

        ViewManager.removeView(viewId);
    };
}

// Export a singleton instance
const tabManager = new TabManager();
export default tabManager;
