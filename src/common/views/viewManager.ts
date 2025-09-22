// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

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
import Config from 'common/config';
import {Logger} from 'common/log';
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

    getViewTitle = (viewId: string) => {
        const view = this.getView(viewId);
        if (!view) {
            return '';
        }
        const {channelName, teamName, serverName} = view.title;
        if (channelName) {
            if (teamName && [...this.views.values()].some((v) => v.id !== view.id && v.title.channelName === channelName)) {
                return `${channelName} - ${teamName}`;
            }
            return channelName;
        }

        return teamName ?? serverName;
    };

    getViewsByServerId = (serverId: string) => {
        return Array.from(this.views.values()).filter((view) => view.serverId === serverId);
    };

    getPrimaryView = (serverId: string) => {
        const viewId = this.serverPrimaryViews.get(serverId);
        if (!viewId) {
            return undefined;
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

    isViewLimitReached = () => {
        return Boolean(Config.viewLimit && this.views.size >= Config.viewLimit);
    };

    createView = (server: MattermostServer, type: ViewType) => {
        log.debug('createView', {serverId: server.id, type});

        if (this.isViewLimitReached()) {
            log.warn(`createView: View limit reached for server ${server.id}`);
            return undefined;
        }

        const newView = new MattermostView(server, type);
        this.views.set(newView.id, newView);

        if (type === ViewType.TAB && !this.serverPrimaryViews.has(server.id)) {
            this.serverPrimaryViews.set(server.id, newView.id);
        }

        // Emit view-opened event to notify WebContentsManager
        this.emit(VIEW_CREATED, newView.id);
        return newView;
    };

    updateViewTitle = (viewId: string, channelName?: string, teamName?: string) => {
        log.debug('updateViewTitle', {viewId});

        const view = this.views.get(viewId);
        if (!view) {
            return;
        }
        view.title = {
            serverName: view.title.serverName,
            channelName,
            teamName,
        };
        this.emit(VIEW_TITLE_UPDATED, view.id);
    };

    updateViewType = (viewId: string, type: ViewType) => {
        log.debug('updateViewType', {viewId, type});

        const view = this.views.get(viewId);
        if (!view || view.type === type) {
            return;
        }
        this.setNewPrimaryViewIfNeeded(view);
        this.emit(VIEW_TYPE_REMOVED, view.id, view.type);
        view.type = type;
        this.emit(VIEW_TYPE_ADDED, view.id, view.type);
    };

    setPrimaryView = (viewId: string) => {
        log.debug('setPrimaryView', {viewId});

        const view = this.views.get(viewId);
        if (!view) {
            return;
        }

        this.serverPrimaryViews.set(view.serverId, viewId);
        this.emit(VIEW_PRIMARY_UPDATED, view.serverId, viewId);
    };

    removeView = (viewId: string) => {
        log.debug('removeView', {viewId});

        const view = this.views.get(viewId);
        if (!view) {
            return;
        }

        this.setNewPrimaryViewIfNeeded(view);

        this.views.delete(viewId);
        this.emit(VIEW_REMOVED, viewId, view.serverId);
    };

    private setNewPrimaryViewIfNeeded = (view: MattermostView) => {
        if (this.serverPrimaryViews.get(view.serverId) === view.id) {
            const newPrimaryView = Array.from(this.views.values()).find((v) => view.serverId === v.serverId && v.id !== view.id && v.type === ViewType.TAB);
            if (newPrimaryView) {
                this.setPrimaryView(newPrimaryView.id);
            }
        }
    };

    getViewLog = (viewId: string, ...additionalPrefixes: string[]) => {
        const view = this.getView(viewId);
        if (!view) {
            return new Logger(viewId);
        }
        const server = ServerManager.getServer(view.serverId);
        if (!server) {
            return new Logger(...additionalPrefixes, viewId);
        }
        return new Logger(...additionalPrefixes, server.id, viewId);
    };

    private handleServerWasRemoved = (server: MattermostServer) => {
        log.debug('handleServerWasRemoved', {serverId: server.id});

        this.views.forEach((view) => {
            if (view.serverId === server.id) {
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
