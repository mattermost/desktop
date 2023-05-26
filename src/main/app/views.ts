// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IpcMainEvent, IpcMainInvokeEvent} from 'electron';

import ServerViewState from 'app/serverViewState';

import ServerManager from 'common/servers/serverManager';
import {Logger} from 'common/log';

import ViewManager from 'main/views/viewManager';

const log = new Logger('App.Views');

export const handleCloseView = (event: IpcMainEvent, viewId: string) => {
    log.debug('handleCloseView', {viewId});

    const view = ServerManager.getView(viewId);
    if (!view) {
        return;
    }
    ServerManager.setViewIsOpen(viewId, false);
    const nextView = ServerManager.getLastActiveTabForServer(view.server.id);
    ViewManager.showById(nextView.id);
};

export const handleOpenView = (event: IpcMainEvent, viewId: string) => {
    log.debug('handleOpenView', {viewId});

    ServerManager.setViewIsOpen(viewId, true);
    ViewManager.showById(viewId);
};

export const selectNextView = () => {
    selectView((order) => order + 1);
};

export const selectPreviousView = () => {
    selectView((order, length) => (length + (order - 1)));
};

export const handleGetOrderedViewsForServer = (event: IpcMainInvokeEvent, serverId: string) => {
    return ServerManager.getOrderedTabsForServer(serverId).map((view) => view.toUniqueView());
};

export const handleGetLastActive = () => {
    const server = ServerViewState.getCurrentServer();
    const view = ServerManager.getLastActiveTabForServer(server.id);
    return {server: server.id, view: view.id};
};

const selectView = (fn: (order: number, length: number) => number) => {
    const currentView = ViewManager.getCurrentView();
    if (!currentView) {
        return;
    }

    const currentServerViews = ServerManager.getOrderedTabsForServer(currentView.view.server.id).map((view, index) => ({view, index}));
    const filteredViews = currentServerViews?.filter((view) => view.view.isOpen);
    const currentServerView = currentServerViews?.find((view) => view.view.type === currentView.view.type);
    if (!currentServerViews || !currentServerView || !filteredViews) {
        return;
    }

    let currentOrder = currentServerView.index;
    let nextIndex = -1;
    while (nextIndex === -1) {
        const nextOrder = (fn(currentOrder, currentServerViews.length) % currentServerViews.length);
        nextIndex = filteredViews.findIndex((view) => view.index === nextOrder);
        currentOrder = nextOrder;
    }

    const newView = filteredViews[nextIndex].view;
    ViewManager.showById(newView.id);
};
