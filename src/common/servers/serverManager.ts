// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

import {
    SERVERS_URL_MODIFIED,
    SERVERS_UPDATE,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import {MattermostServer} from 'common/servers/MattermostServer';
import {getFormattedPathName, isInternalURL, parseURL} from 'common/utils/url';

import type {Server} from 'types/config';
import type {RemoteInfo} from 'types/server';

const log = new Logger('ServerManager');

export class ServerManager extends EventEmitter {
    private servers: Map<string, MattermostServer>;
    private remoteInfo: Map<string, RemoteInfo>;
    private serverOrder: string[];
    private currentServerId?: string;
    private isReloadingFromConfig = false;

    constructor() {
        super();

        this.servers = new Map();
        this.remoteInfo = new Map();
        this.serverOrder = [];
    }

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

    getServer = (id: string) => {
        return this.servers.get(id);
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
            this.persistServers(this.currentServerId ? this.serverOrder.indexOf(this.currentServerId) : undefined);
        }
    };

    lookupViewByURL = (inputURL: URL | string, ignoreScheme = false) => {
        log.silly('lookupViewByURL', `${inputURL}`, ignoreScheme);

        const parsedURL = parseURL(inputURL);
        if (!parsedURL) {
            return undefined;
        }
        return this.getAllServers().find((server) => {
            return isInternalURL(parsedURL, server.url, ignoreScheme) &&
                getFormattedPathName(parsedURL.pathname).startsWith(getFormattedPathName(server.url.pathname));
        });
    };

    updateServerOrder = (serverOrder: string[]) => {
        log.debug('updateServerOrder', serverOrder);

        this.serverOrder = serverOrder;
        this.persistServers(this.currentServerId ? this.serverOrder.indexOf(this.currentServerId) : undefined);
    };

    addServer = (server: Server, initialLoadURL?: URL) => {
        const newServer = new MattermostServer(server, false, initialLoadURL);

        if (this.servers.has(newServer.id)) {
            throw new Error('ID Collision detected. Cannot add server.');
        }
        this.servers.set(newServer.id, newServer);

        this.serverOrder.push(newServer.id);

        // If this is the first server, set it as the current server
        if (this.servers.size === 1) {
            this.currentServerId = newServer.id;
        }

        // Emit this event whenever we update a server URL to ensure remote info is fetched
        this.emit(SERVERS_URL_MODIFIED, [newServer.id]);
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

        urlModified?.();
        this.persistServers(this.currentServerId ? this.serverOrder.indexOf(this.currentServerId) : undefined);
    };

    getCurrentServerId = () => {
        return this.currentServerId;
    };

    // Remove setCurrentServer method since we only need to persist changes when switching or removing servers
    private updateCurrentServer = (serverId: string | undefined) => {
        this.currentServerId = serverId;
    };

    switchServer = (serverId: string | undefined) => {
        this.updateCurrentServer(serverId);
        if (serverId) {
            const orderedServers = this.getOrderedServers();
            const serverIndex = orderedServers.findIndex((s) => s.id === serverId);
            if (serverIndex !== -1) {
                this.persistServers(serverIndex);
            }
        }
    };

    removeServer = (serverId: string) => {
        const index = this.serverOrder.findIndex((id) => id === serverId);
        this.serverOrder.splice(index, 1);
        this.remoteInfo.delete(serverId);
        this.servers.delete(serverId);

        // Update currentServerId if we removed the current server
        if (this.currentServerId === serverId) {
            this.updateCurrentServer(this.serverOrder[0]);
        }

        // Persist the updated server list
        this.persistServers(this.currentServerId ? this.serverOrder.indexOf(this.currentServerId) : undefined);
    };

    reloadFromConfig = () => {
        this.isReloadingFromConfig = true;
        const serverOrder: string[] = [];
        Config.predefinedServers.forEach((server) => {
            const id = this.initServer(server, true);
            if (id) {
                serverOrder.push(id);
            }
        });
        if (Config.enableServerManagement) {
            Config.localServers.forEach((server) => {
                const id = this.initServer(server, false);
                if (id) {
                    serverOrder.push(id);
                }
            });
        }
        this.filterOutDuplicateServers();
        this.serverOrder = serverOrder;

        // Set the current server based on the config
        if (Config.lastActiveServer !== undefined && this.serverOrder[Config.lastActiveServer]) {
            this.updateCurrentServer(this.serverOrder[Config.lastActiveServer]);
        } else if (this.serverOrder.length > 0) {
            this.updateCurrentServer(this.serverOrder[0]);
        }

        // Emit SERVERS_UPDATE to notify the tab bar without persisting
        const servers = this.getOrderedServers().map((server) => ({
            name: server.name,
            url: server.url.toString(),
        }));
        if (servers.length) {
            this.emit(SERVERS_UPDATE, servers);
        }
        this.isReloadingFromConfig = false;
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

    private initServer = (server: Server, isPredefined: boolean) => {
        const newServer = new MattermostServer(server, isPredefined);
        if (this.servers.has(newServer.id)) {
            return newServer.id;
        }
        this.servers.set(newServer.id, newServer);

        return newServer.id;
    };

    private persistServers = (lastActiveServer?: number) => {
        const servers = this.getOrderedServers().map((server) => {
            return {
                name: server.name,
                url: server.url.toString(),
            };
        });
        Config.setServers(servers, lastActiveServer);
        this.emit(SERVERS_UPDATE, servers);
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
        return [id, ...prefixes];
    };

    getServerLog = (serverId: string, ...additionalPrefixes: string[]) => {
        const server = this.getServer(serverId);
        if (!server) {
            return new Logger(serverId);
        }
        return new Logger(...additionalPrefixes, ...this.includeId(serverId, server.name));
    };
}

const serverManager = new ServerManager();
export default serverManager;
