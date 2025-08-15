// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

import AppState from 'common/appState';
import {
    VIEW_CREATED,
    VIEW_TITLE_UPDATED,
    VIEW_PRIMARY_UPDATED,
    VIEW_REMOVED,
    SERVER_ADDED,
    SERVER_REMOVED,
    VIEW_TYPE_REMOVED,
    VIEW_TYPE_ADDED,
} from 'common/communication';
import {Logger, getLevel} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {MattermostView, ViewType} from 'common/views/MattermostView';

const log = new Logger('ViewManager');

export class ViewManager extends EventEmitter {
    private views: Map<string, MattermostView>;
    private serverPrimaryViews: Map<string, string>;

    constructor() {
        super();

        this.views = new Map();
        this.serverPrimaryViews = new Map();

        ServerManager.on(SERVER_REMOVED, this.handleServerWasRemoved);
        ServerManager.on(SERVER_ADDED, this.handleServerWasAdded);
    }

    getView = (id: string) => {
        return this.views.get(id);
    };

    getPrimaryView = (serverId: string) => {
        const viewId = this.serverPrimaryViews.get(serverId);
        if (!viewId) {
            return null;
        }
        return this.getView(viewId);
    };

    isPrimaryView = (viewId: string): boolean => {
        const view = this.views.get(viewId);
        if (!view) {
            return false;
        }
        return this.serverPrimaryViews.get(view.serverId) === viewId;
    };

    createView = (server: MattermostServer, type: ViewType) => {
        log.debug('createView', server.id, server.name, type);

        const newView = new MattermostView(server, type);
        this.views.set(newView.id, newView);

        if (type === ViewType.TAB && !this.serverPrimaryViews.has(server.id)) {
            this.serverPrimaryViews.set(server.id, newView.id);
        }

        // Emit view-opened event to notify WebContentsManager
        this.emit(VIEW_CREATED, newView.id);
        return newView;
    };

    updateViewTitle = (viewId: string, title: string) => {
        log.debug('updateViewTitle', viewId, title);

        const view = this.views.get(viewId);
        if (!view) {
            return;
        }
        view.title = title;
        this.emit(VIEW_TITLE_UPDATED, view.id);
    };

    updateViewType = (viewId: string, type: ViewType) => {
        log.debug('updateViewType', viewId, type);

        const view = this.views.get(viewId);
        if (!view || view.type === type) {
            return;
        }
        this.emit(VIEW_TYPE_REMOVED, view.id, view.type);
        view.type = type;
        this.emit(VIEW_TYPE_ADDED, view.id, view.type);
    };

    setPrimaryView = (viewId: string) => {
        log.debug('setPrimaryView', viewId);

        const view = this.views.get(viewId);
        if (!view) {
            return;
        }
        const currentPrimaryViewId = this.serverPrimaryViews.get(view.serverId);
        if (currentPrimaryViewId) {
            AppState.switch(currentPrimaryViewId, viewId);
        }
        this.serverPrimaryViews.set(view.serverId, viewId);
        this.emit(VIEW_PRIMARY_UPDATED, view.serverId, viewId);
    };

    removeView = (viewId: string) => {
        log.debug('removeView', viewId);

        const view = this.views.get(viewId);
        if (!view) {
            return;
        }

        if (this.serverPrimaryViews.get(view.serverId) === viewId) {
            const newPrimaryView = Array.from(this.views.values()).find((v) => view.serverId === v.serverId && v.id !== viewId);
            if (newPrimaryView) {
                this.setPrimaryView(newPrimaryView.id);
            }
        }

        this.views.delete(viewId);
        this.emit(VIEW_REMOVED, viewId, view.serverId);
    };

    getViewLog = (viewId: string, ...additionalPrefixes: string[]) => {
        const view = this.getView(viewId);
        if (!view) {
            return new Logger(viewId);
        }
        const server = ServerManager.getServer(view.serverId);
        if (!server) {
            return new Logger(...additionalPrefixes, ...this.includeId(viewId));
        }
        return new Logger(...additionalPrefixes, ...this.includeId(viewId, server.name));
    };

    private includeId = (id: string, ...prefixes: string[]) => {
        const shouldInclude = ['debug', 'silly'].includes(getLevel());
        return shouldInclude ? [id, ...prefixes] : prefixes;
    };

    private handleServerWasRemoved = (serverId: string) => {
        log.debug('handleServerWasRemoved', serverId);

        this.views.forEach((view) => {
            if (view.serverId === serverId) {
                this.removeView(view.id);
            }
        });
    };

    private handleServerWasAdded = (serverId: string, setAsCurrentServer: boolean) => {
        log.debug('handleServerWasAdded', serverId, setAsCurrentServer);

        const server = ServerManager.getServer(serverId);
        if (!server) {
            return;
        }

        // Create an initial tab view for the server
        this.createView(server, ViewType.TAB);
    };
}

const viewManager = new ViewManager();
export default viewManager;
