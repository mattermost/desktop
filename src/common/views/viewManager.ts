// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';
import {v4 as uuidv4} from 'uuid';

import {
    SERVERS_UPDATE,
} from 'common/communication';
import {Logger, getLevel} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';

import type {UniqueView} from 'types/config';

const log = new Logger('ViewManager');

export interface MattermostView {
    id: string;
    server: MattermostServer;
    url: URL;
    title: string;
    toUniqueView: () => UniqueView;
}

export class ViewManager extends EventEmitter {
    private views: Map<string, MattermostView>;
    private viewOrder: Map<string, string[]>;
    private activeView: MattermostView | null;
    private viewTitles: Map<string, string>;
    private serverCurrentViews: Map<string, string>; // Maps server ID to its current view ID
    private serverPrimaryViews: Map<string, string>; // Maps server ID to its primary view ID

    constructor() {
        super();

        this.views = new Map();
        this.viewOrder = new Map();
        this.activeView = null;
        this.viewTitles = new Map();
        this.serverCurrentViews = new Map();
        this.serverPrimaryViews = new Map();

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
        this.serverCurrentViews.set(server.id, newView.id);
        this.serverPrimaryViews.set(server.id, newView.id); // First view is primary

        // Emit view-opened event to notify WebContentsManager
        this.emit('view-opened', newView.id);
    };

    createNewTab = (server: MattermostServer) => {
        const viewOrder = this.viewOrder.get(server.id) || [];
        const newView = this.getNewView(server);
        this.views.set(newView.id, newView);
        viewOrder.push(newView.id);
        this.viewOrder.set(server.id, viewOrder);
        this.serverCurrentViews.set(server.id, newView.id);

        // Emit view-opened event to notify WebContentsManager
        this.emit('view-opened', newView.id);
        return newView;
    };

    removeServerViews = (serverId: string) => {
        this.viewOrder.get(serverId)?.forEach((viewId) => this.views.delete(viewId));
        this.viewOrder.delete(serverId);
        this.serverCurrentViews.delete(serverId);
        this.serverPrimaryViews.delete(serverId);
    };

    private getFirstViewForServer = (serverId: string) => {
        const viewOrder = this.getOrderedTabsForServer(serverId);
        const firstView = viewOrder[0];
        if (!firstView) {
            throw new Error(`No views for server id ${serverId}`);
        }
        return firstView;
    };

    setViewTitle = (viewId: string, title: string) => {
        this.viewTitles.set(viewId, title);
        const view = this.views.get(viewId);
        if (view) {
            view.title = title;
        }
    };

    getViewTitle = (viewId: string) => {
        return this.viewTitles.get(viewId);
    };

    private getNewView = (srv: MattermostServer): MattermostView => {
        const viewId = `${srv.id}_view_${uuidv4()}`;
        return {
            id: viewId,
            server: srv,
            url: srv.url,
            title: this.viewTitles.get(viewId) || srv.name,
            toUniqueView: () => ({
                id: viewId,
                server: {
                    id: srv.id,
                    name: srv.name,
                    url: srv.url.toString(),
                },
                url: srv.url,
                pageTitle: this.viewTitles.get(viewId) || srv.name,
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
        log.debug('setActiveView', view?.id);
        if (this.activeView?.id !== view?.id) {
            this.activeView = view;
            if (view) {
                this.serverCurrentViews.set(view.server.id, view.id);
            }
            this.emit('view-activated', view);
        }
    };

    getCurrentViewForServer = (serverId: string): MattermostView | null => {
        const viewId = this.serverCurrentViews.get(serverId);
        if (!viewId) {
            return null;
        }
        return this.views.get(viewId) || null;
    };

    removeView = (viewId: string) => {
        this.views.delete(viewId);
        this.viewTitles.delete(viewId);
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
        log.verbose('Closing view', id);

        const view = this.views.get(id);
        if (!view) {
            return;
        }

        // Remove from views map
        this.removeView(id);

        // Remove from viewOrder map
        const serverViewOrder = this.viewOrder.get(view.server.id);
        if (serverViewOrder) {
            this.viewOrder.set(view.server.id, serverViewOrder.filter((viewId) => viewId !== id));
        }

        // Update server's current view if needed
        if (this.serverCurrentViews.get(view.server.id) === id) {
            const serverViews = this.getOrderedTabsForServer(view.server.id);
            if (serverViews.length > 0) {
                this.serverCurrentViews.set(view.server.id, serverViews[0].id);
            } else {
                this.serverCurrentViews.delete(view.server.id);
            }
        }

        // Update primary view if needed
        if (this.serverPrimaryViews.get(view.server.id) === id) {
            const serverViews = this.getOrderedTabsForServer(view.server.id);
            if (serverViews.length > 0) {
                log.debug('Updating primary view for server', view.server.id, serverViews[0].id);
                this.serverPrimaryViews.set(view.server.id, serverViews[0].id);
            } else {
                this.serverPrimaryViews.delete(view.server.id);
            }
        }

        if (this.activeView?.id === id) {
            this.activeView = null;
        }
        this.emit('view-closed', id);

        // Notify all components that the server state has changed
        const servers = ServerManager.getOrderedServers().map((server) => ({
            name: server.name,
            url: server.url.toString(),
        }));
        this.emit(SERVERS_UPDATE, servers);
    };

    reloadFromConfig = () => {
        // Clear existing views
        this.views.clear();
        this.viewOrder.clear();
        this.activeView = null;
        this.viewTitles.clear();
        this.serverCurrentViews.clear();
        this.serverPrimaryViews.clear();

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

    isPrimaryView = (viewId: string): boolean => {
        const view = this.views.get(viewId);
        if (!view) {
            return false;
        }
        return this.serverPrimaryViews.get(view.server.id) === viewId;
    };

    getPrimaryViewForServer = (serverId: string): MattermostView | null => {
        const viewId = this.serverPrimaryViews.get(serverId);
        if (!viewId) {
            return null;
        }
        return this.views.get(viewId) || null;
    };
}

const viewManager = new ViewManager();
export default viewManager;
