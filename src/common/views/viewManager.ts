// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

import {Logger, getLevel} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';

import type {UniqueView} from 'types/config';

const log = new Logger('ViewManager');

export interface MattermostView {
    id: string;
    server: MattermostServer;
    url: URL;
    shouldNotify: boolean;
    toUniqueView: () => UniqueView;
}

export class ViewManager extends EventEmitter {
    private views: Map<string, MattermostView>;
    private viewOrder: Map<string, string[]>;
    private activeView: MattermostView | null;

    constructor() {
        super();

        this.views = new Map();
        this.viewOrder = new Map();
        this.activeView = null;

        // Subscribe to server events
        ServerManager.on('servers-removed', this.handleServerWasRemoved);
        ServerManager.on('servers-added', this.handleServerWasAdded);
        ServerManager.on('servers-updated', this.handleServerWasUpdated);
    }

    getOrderedTabsForServer = (serverId: string) => {
        log.withPrefix(serverId).debug('getOrderedTabsForServer');

        const viewOrder = this.viewOrder.get(serverId);
        if (!viewOrder) {
            return [];
        }
        return viewOrder.reduce((views, viewId) => {
            const view = this.views.get(viewId);
            if (view) {
                views.push(view);
            }
            return views;
        }, [] as MattermostView[]);
    };

    getView = (id: string) => {
        return this.views.get(id);
    };

    updateTabOrder = (serverId: string, viewOrder: string[]) => {
        log.withPrefix(serverId).debug('updateTabOrder', viewOrder);
        this.viewOrder.set(serverId, viewOrder);
        this.emit('view-order-updated', serverId);
    };

    addServerViews = (server: MattermostServer) => {
        const viewOrder: string[] = [];

        // Create a single view for the server
        const newView = this.getNewView(server);
        this.views.set(newView.id, newView);
        viewOrder.push(newView.id);
        this.viewOrder.set(server.id, viewOrder);

        // Emit view-opened event to notify WebContentsManager
        this.emit('view-opened', newView.id);
    };

    removeServerViews = (serverId: string) => {
        this.viewOrder.get(serverId)?.forEach((viewId) => this.views.delete(viewId));
        this.viewOrder.delete(serverId);
    };

    private getFirstViewForServer = (serverId: string) => {
        const viewOrder = this.getOrderedTabsForServer(serverId);
        const firstView = viewOrder[0];
        if (!firstView) {
            throw new Error(`No views for server id ${serverId}`);
        }
        return firstView;
    };

    private getNewView = (srv: MattermostServer): MattermostView => {
        return {
            id: `${srv.id}_view`,
            server: srv,
            url: srv.url,
            shouldNotify: false,
            toUniqueView: () => ({
                id: `${srv.id}_view`,
                server: {
                    id: srv.id,
                    name: srv.name,
                    url: srv.url.toString(),
                },
                url: srv.url,
                shouldNotify: false,
            }),
        };
    };

    getViewLog = (viewId: string, ...additionalPrefixes: string[]) => {
        const view = this.getView(viewId);
        if (!view) {
            return new Logger(viewId);
        }
        return new Logger(...additionalPrefixes, ...this.includeId(viewId, view.server.name));
    };

    private includeId = (id: string, ...prefixes: string[]) => {
        const shouldInclude = ['debug', 'silly'].includes(getLevel());
        return shouldInclude ? [id, ...prefixes] : prefixes;
    };

    getViewByServerId = (serverId: string): MattermostView | undefined => {
        return Array.from(this.views.values()).find((view) => view.server.id === serverId);
    };

    getAllViews = (): MattermostView[] => {
        return Array.from(this.views.values());
    };

    getActiveView = (): MattermostView | null => {
        return this.activeView;
    };

    getActiveViewByServerId = (serverId: string): MattermostView | undefined => {
        return Array.from(this.views.values()).find((view) => view.server.id === serverId);
    };

    setActiveView = (view: MattermostView | null) => {
        if (this.activeView?.id !== view?.id) {
            this.activeView = view;
            this.emit('view-activated', view);
        }
    };

    removeView = (viewId: string) => {
        this.views.delete(viewId);
        if (this.activeView?.id === viewId) {
            this.activeView = null;
        }
    };

    isViewClosed = (viewId: string) => {
        return !this.views.has(viewId);
    };

    openClosedView = (id: string, srv: MattermostServer) => {
        const view = this.getNewView(srv);
        this.views.set(id, view);
        this.emit('view-opened', id);
    };

    closeView = (id: string) => {
        this.views.delete(id);
        if (this.activeView?.id === id) {
            this.activeView = null;
        }
        this.emit('view-closed', id);
    };

    reloadFromConfig = () => {
        // Clear existing views
        this.views.clear();
        this.viewOrder.clear();
        this.activeView = null;

        // Load views for all servers
        ServerManager.getAllServers().forEach((server) => {
            this.addServerViews(server);
        });
    };

    private handleServerWasRemoved = (serverIds: string[]) => {
        log.debug('handleServerWasRemoved', serverIds);
        serverIds.forEach((serverId) => {
            const views = Array.from(this.views.values()).filter((view) => view.server.id === serverId);
            views.forEach((view) => {
                this.removeView(view.id);
            });
        });
    };

    private handleServerWasAdded = (servers: MattermostServer[]) => {
        log.debug('handleServerWasAdded', servers);
        servers.forEach((server) => {
            const view = this.getNewView(server);
            log.debug('Created new view for server', view.id, server.id);
        });
    };

    private handleServerWasUpdated = (servers: MattermostServer[]) => {
        log.debug('handleServerWasUpdated', servers);
        servers.forEach((server) => {
            const view = this.getViewByServerId(server.id);
            if (view) {
                view.server = server;
            }
        });
    };
}

const viewManager = new ViewManager();
export default viewManager;
