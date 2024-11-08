// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

import {
    SERVERS_URL_MODIFIED,
    SERVERS_UPDATE,
} from 'common/communication';
import Config from 'common/config';
import {Logger, getLevel} from 'common/log';
import {MattermostServer} from 'common/servers/MattermostServer';
import {getFormattedPathName, isInternalURL, parseURL} from 'common/utils/url';
import FocalboardView from 'common/views/FocalboardView';
import MessagingView from 'common/views/MessagingView';
import PlaybooksView from 'common/views/PlaybooksView';
import type {MattermostView} from 'common/views/View';
import {TAB_FOCALBOARD, TAB_MESSAGING, TAB_PLAYBOOKS, getDefaultViews} from 'common/views/View';

import type {Server, ConfigServer, ConfigView} from 'types/config';
import type {RemoteInfo} from 'types/server';

const log = new Logger('ServerManager');

export class ServerManager extends EventEmitter {
    private servers: Map<string, MattermostServer>;
    private remoteInfo: Map<string, RemoteInfo>;
    private serverOrder: string[];

    private views: Map<string, MattermostView>;
    private viewOrder: Map<string, string[]>;
    private lastActiveView: Map<string, string>;

    constructor() {
        super();

        this.servers = new Map();
        this.remoteInfo = new Map();
        this.serverOrder = [];
        this.views = new Map();
        this.viewOrder = new Map();
        this.lastActiveView = new Map();
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

    getOrderedServers = () => {
        log.debug('getOrderedServers');

        return this.serverOrder.reduce((servers, srv) => {
            const server = this.servers.get(srv);
            if (server) {
                servers.push(server);
            }
            return servers;
        }, [] as MattermostServer[]);
    };

    getLastActiveTabForServer = (serverId: string) => {
        log.withPrefix(serverId).debug('getLastActiveTabForServer');

        const lastActiveView = this.lastActiveView.get(serverId);
        if (lastActiveView) {
            const view = this.views.get(lastActiveView);
            if (view && view?.isOpen) {
                return view;
            }
        }
        return this.getFirstOpenViewForServer(serverId);
    };

    getServer = (id: string) => {
        return this.servers.get(id);
    };

    getView = (id: string) => {
        return this.views.get(id);
    };

    getAllServers = () => {
        return [...this.servers.values()];
    };

    hasServers = () => {
        return Boolean(this.servers.size);
    };

    getRemoteInfo = (serverId: string) => {
        return this.remoteInfo.get(serverId);
    };

    updateRemoteInfos = (remoteInfos: Map<string, RemoteInfo>) => {
        let hasUpdates = false;
        remoteInfos.forEach((remoteInfo, serverId) => {
            this.remoteInfo.set(serverId, remoteInfo);
            hasUpdates = this.updateServerURL(serverId) || hasUpdates;
        });

        if (hasUpdates) {
            this.persistServers();
        }
    };

    lookupViewByURL = (inputURL: URL | string, ignoreScheme = false) => {
        log.silly('lookupViewByURL', `${inputURL}`, ignoreScheme);

        const parsedURL = parseURL(inputURL);
        if (!parsedURL) {
            return undefined;
        }
        const server = this.getAllServers().find((server) => {
            return isInternalURL(parsedURL, server.url, ignoreScheme) &&
                getFormattedPathName(parsedURL.pathname).startsWith(getFormattedPathName(server.url.pathname));
        });
        if (!server) {
            return undefined;
        }
        const views = this.getOrderedTabsForServer(server.id);

        let selectedView = views.find((view) => view && view.type === TAB_MESSAGING);
        views.
            filter((view) => view && view.type !== TAB_MESSAGING).
            forEach((view) => {
                if (getFormattedPathName(parsedURL.pathname).startsWith(getFormattedPathName(view.url.pathname))) {
                    selectedView = view;
                }
            });
        return selectedView;
    };

    updateServerOrder = (serverOrder: string[]) => {
        log.debug('updateServerOrder', serverOrder);

        this.serverOrder = serverOrder;
        this.persistServers();
    };

    updateTabOrder = (serverId: string, viewOrder: string[]) => {
        log.withPrefix(serverId).debug('updateTabOrder', viewOrder);

        this.viewOrder.set(serverId, viewOrder);
        this.persistServers();
    };

    addServer = (server: Server, initialLoadURL?: URL) => {
        const newServer = new MattermostServer(server, false, initialLoadURL);

        if (this.servers.has(newServer.id)) {
            throw new Error('ID Collision detected. Cannot add server.');
        }
        this.servers.set(newServer.id, newServer);

        this.serverOrder.push(newServer.id);
        const viewOrder: string[] = [];
        getDefaultViews().forEach((view) => {
            const newView = this.getNewView(newServer, view.name, view.isOpen);
            this.views.set(newView.id, newView);
            viewOrder.push(newView.id);
        });
        this.viewOrder.set(newServer.id, viewOrder);

        // Emit this event whenever we update a server URL to ensure remote info is fetched
        this.emit(SERVERS_URL_MODIFIED, [newServer.id]);
        this.persistServers();
        return newServer;
    };

    editServer = (serverId: string, server: Server) => {
        const existingServer = this.servers.get(serverId);
        if (!existingServer) {
            return;
        }

        let urlModified;
        if (existingServer.url.toString() !== parseURL(server.url)?.toString()) {
            // Emit this event whenever we update a server URL to ensure remote info is fetched
            urlModified = () => this.emit(SERVERS_URL_MODIFIED, [serverId]);
        }
        existingServer.name = server.name;
        existingServer.updateURL(server.url);
        this.servers.set(serverId, existingServer);

        this.viewOrder.get(serverId)?.forEach((viewId) => {
            const view = this.views.get(viewId);
            if (view) {
                view.server = existingServer;
                this.views.set(viewId, view);
            }
        });

        urlModified?.();
        this.persistServers();
    };

    removeServer = (serverId: string) => {
        this.viewOrder.get(serverId)?.forEach((viewId) => this.views.delete(viewId));
        this.viewOrder.delete(serverId);
        this.lastActiveView.delete(serverId);

        const index = this.serverOrder.findIndex((id) => id === serverId);
        this.serverOrder.splice(index, 1);
        this.remoteInfo.delete(serverId);
        this.servers.delete(serverId);

        this.persistServers();
    };

    setViewIsOpen = (viewId: string, isOpen: boolean) => {
        const view = this.views.get(viewId);
        if (!view) {
            return;
        }
        view.isOpen = isOpen;

        this.persistServers();
    };

    updateLastActive = (viewId: string) => {
        const view = this.views.get(viewId);
        if (!view) {
            return;
        }
        this.lastActiveView.set(view.server.id, viewId);

        const serverOrder = this.serverOrder.findIndex((srv) => srv === view.server.id);
        if (serverOrder < 0) {
            throw new Error('Server order corrupt, ID not found.');
        }

        this.persistServers(serverOrder);
    };

    reloadFromConfig = () => {
        const serverOrder: string[] = [];
        Config.predefinedServers.forEach((server) => {
            const id = this.initServer(server, true);
            serverOrder.push(id);
        });
        if (Config.enableServerManagement) {
            Config.localServers.sort((a, b) => a.order - b.order).forEach((server) => {
                const id = this.initServer(server, false);
                serverOrder.push(id);
            });
        }
        this.filterOutDuplicateServers();
        this.serverOrder = serverOrder;
    };

    private filterOutDuplicateServers = () => {
        const servers = [...this.servers.keys()].map((key) => ({key, value: this.servers.get(key)!}));
        const uniqueServers = new Set();
        servers.forEach((server) => {
            if (uniqueServers.has(`${server.value.name}:${server.value.url}`)) {
                this.servers.delete(server.key);
            } else {
                uniqueServers.add(`${server.value.name}:${server.value.url}`);
            }
        });
    };

    private initServer = (configServer: ConfigServer, isPredefined: boolean) => {
        const server = new MattermostServer(configServer, isPredefined);
        this.servers.set(server.id, server);

        log.withPrefix(server.id).debug('initialized server');

        const viewOrder: string[] = [];
        configServer.tabs.sort((a, b) => a.order - b.order).forEach((view) => {
            const mattermostView = this.getNewView(server, view.name, view.isOpen);
            log.withPrefix(mattermostView.id).debug('initialized view');

            this.views.set(mattermostView.id, mattermostView);
            viewOrder.push(mattermostView.id);
        });
        this.viewOrder.set(server.id, viewOrder);
        if (typeof configServer.lastActiveTab !== 'undefined') {
            this.lastActiveView.set(server.id, viewOrder[configServer.lastActiveTab]);
        }
        return server.id;
    };

    private getFirstOpenViewForServer = (serverId: string) => {
        const viewOrder = this.getOrderedTabsForServer(serverId);
        const openViews = viewOrder.filter((view) => view.isOpen);
        const firstView = openViews[0];
        if (!firstView) {
            throw new Error(`No views open for server id ${serverId}`);
        }
        return firstView;
    };

    private persistServers = async (lastActiveServer?: number) => {
        this.emit(SERVERS_UPDATE);

        const localServers = [...this.servers.values()].
            reduce((servers, srv) => {
                if (srv.isPredefined) {
                    return servers;
                }
                servers.push(this.toConfigServer(srv));
                return servers;
            }, [] as ConfigServer[]);
        await Config.setServers(localServers, lastActiveServer);
    };

    private getLastActiveView = (serverId: string) => {
        let lastActiveView: number | undefined;
        if (this.lastActiveView.has(serverId)) {
            const index = this.viewOrder.get(serverId)?.indexOf(this.lastActiveView.get(serverId)!);
            if (typeof index !== 'undefined' && index >= 0) {
                lastActiveView = index;
            }
        }
        return lastActiveView;
    };

    private toConfigServer = (server: MattermostServer): ConfigServer => {
        return {
            name: server.name,
            url: `${server.url}`,
            order: this.serverOrder.indexOf(server.id),
            lastActiveTab: this.getLastActiveView(server.id),
            tabs: this.viewOrder.get(server.id)?.reduce((views, viewId, index) => {
                const view = this.views.get(viewId);
                if (!view) {
                    return views;
                }
                views.push({
                    name: view?.type,
                    order: index,
                    isOpen: view.isOpen,
                });
                return views;
            }, [] as ConfigView[]) ?? [],
        };
    };

    private getNewView = (srv: MattermostServer, viewName: string, isOpen?: boolean) => {
        switch (viewName) {
        case TAB_MESSAGING:
            return new MessagingView(srv, isOpen);
        case TAB_FOCALBOARD:
            return new FocalboardView(srv, isOpen);
        case TAB_PLAYBOOKS:
            return new PlaybooksView(srv, isOpen);
        default:
            throw new Error('Not implemeneted');
        }
    };

    private updateServerURL = (serverId: string) => {
        const server = this.servers.get(serverId);
        const remoteInfo = this.remoteInfo.get(serverId);

        if (!(server && remoteInfo)) {
            return false;
        }

        if (remoteInfo.siteURL && server.url.toString() !== new URL(remoteInfo.siteURL).toString()) {
            server.updateURL(remoteInfo.siteURL);
            this.servers.set(serverId, server);
            return true;
        }
        return false;
    };

    private includeId = (id: string, ...prefixes: string[]) => {
        const shouldInclude = ['debug', 'silly'].includes(getLevel());
        return shouldInclude ? [id, ...prefixes] : prefixes;
    };

    getServerLog = (serverId: string, ...additionalPrefixes: string[]) => {
        const server = this.getServer(serverId);
        if (!server) {
            return new Logger(serverId);
        }
        return new Logger(...additionalPrefixes, ...this.includeId(serverId, server.name));
    };

    getViewLog = (viewId: string, ...additionalPrefixes: string[]) => {
        const view = this.getView(viewId);
        if (!view) {
            return new Logger(viewId);
        }
        return new Logger(...additionalPrefixes, ...this.includeId(viewId, view.server.name, view.type));
    };
}

const serverManager = new ServerManager();
export default serverManager;
