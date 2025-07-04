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

import type {ConfigServer, Server} from 'types/config';
import type {RemoteInfo} from 'types/server';

const log = new Logger('ServerManager');

export class ServerManager extends EventEmitter {
    private servers: Map<string, MattermostServer>;
    private remoteInfo: Map<string, RemoteInfo>;
    private serverOrder: string[];

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
            this.persistServers();
        }
    };

    lookupServerByURL = (inputURL: URL | string, ignoreScheme = false) => {
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
        this.persistServers();
    };

    addServer = (server: Server, initialLoadURL?: URL) => {
        const newServer = new MattermostServer(server, false, initialLoadURL);

        if (this.servers.has(newServer.id)) {
            throw new Error('ID Collision detected. Cannot add server.');
        }
        this.servers.set(newServer.id, newServer);
        this.serverOrder.push(newServer.id);

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

        urlModified?.();
        this.persistServers();
    };

    removeServer = (serverId: string) => {
        const index = this.serverOrder.findIndex((id) => id === serverId);
        this.serverOrder.splice(index, 1);
        this.remoteInfo.delete(serverId);
        this.servers.delete(serverId);

        this.persistServers();
    };

    updateLastActive = (serverId: string) => {
        const serverOrder = this.serverOrder.findIndex((srv) => srv === serverId);
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
        return server.id;
    };

    private persistServers = async (lastActiveServer?: number) => {
        this.emit(SERVERS_UPDATE);

        const localServers = [...this.servers.values()].
            reduce((servers, srv) => {
                if (srv.isPredefined) {
                    return servers;
                }
                servers.push({
                    name: srv.name,
                    url: srv.url.toString(),
                    order: this.serverOrder.indexOf(srv.id),
                });
                return servers;
            }, [] as ConfigServer[]);
        await Config.setServers(localServers, lastActiveServer);
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
}

const serverManager = new ServerManager();
export default serverManager;
