// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IpcMainEvent, IpcMainInvokeEvent} from 'electron';

import ServerManager from 'common/servers/serverManager';
import {Logger} from 'common/log';

import ViewManager from 'main/views/viewManager';

const log = new Logger('App.Tabs');

export const handleCloseTab = (event: IpcMainEvent, tabId: string) => {
    log.debug('handleCloseTab', {tabId});

    const tab = ServerManager.getTab(tabId);
    if (!tab) {
        return;
    }
    ServerManager.setTabIsOpen(tabId, false);
    const nextTab = ServerManager.getLastActiveTabForServer(tab.server.id);
    ViewManager.showById(nextTab.id);
};

export const handleOpenTab = (event: IpcMainEvent, tabId: string) => {
    log.debug('handleOpenTab', {tabId});

    ServerManager.setTabIsOpen(tabId, true);
    ViewManager.showById(tabId);
};

export const selectNextTab = () => {
    selectTab((order) => order + 1);
};

export const selectPreviousTab = () => {
    selectTab((order, length) => (length + (order - 1)));
};

export const handleGetOrderedTabsForServer = (event: IpcMainInvokeEvent, serverId: string) => {
    return ServerManager.getOrderedTabsForServer(serverId).map((tab) => tab.toUniqueView());
};

export const handleGetLastActive = () => {
    const server = ServerManager.getCurrentServer();
    const tab = ServerManager.getLastActiveTabForServer(server.id);
    return {server: server.id, tab: tab.id};
};

const selectTab = (fn: (order: number, length: number) => number) => {
    const currentView = ViewManager.getCurrentView();
    if (!currentView) {
        return;
    }

    const currentTeamTabs = ServerManager.getOrderedTabsForServer(currentView.tab.server.id).map((tab, index) => ({tab, index}));
    const filteredTabs = currentTeamTabs?.filter((tab) => tab.tab.isOpen);
    const currentTab = currentTeamTabs?.find((tab) => tab.tab.type === currentView.tab.type);
    if (!currentTeamTabs || !currentTab || !filteredTabs) {
        return;
    }

    let currentOrder = currentTab.index;
    let nextIndex = -1;
    while (nextIndex === -1) {
        const nextOrder = (fn(currentOrder, currentTeamTabs.length) % currentTeamTabs.length);
        nextIndex = filteredTabs.findIndex((tab) => tab.index === nextOrder);
        currentOrder = nextOrder;
    }

    const newTab = filteredTabs[nextIndex].tab;
    ViewManager.showById(newTab.id);
};
