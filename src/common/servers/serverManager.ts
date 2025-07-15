// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

import {
    SERVER_ADDED,
    SERVER_REMOVED,
    SERVER_URL_CHANGED,
    SERVER_NAME_CHANGED,
    SERVER_SWITCHED,
} from 'common/communication';
import Config from 'common/config';
import {Logger, getLevel} from 'common/log';
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

    constructor() {
        super();

        this.servers = new Map();
        this.remoteInfo = new Map();
        this.serverOrder = [];
    }

    hasServers = () => {
        return Boolean(this.servers.size);
    };

    getServer = (id: string) => {
        return this.servers.get(id);
    };

    getAllServers = () => {
        return [...this.servers.values()];
    };

    getOrderedServers = () => {
        return [
            ...[...this.servers.values()].filter((srv) => srv.isPredefined),
            ...this.serverOrder.map((id) => this.servers.get(id)!),
        ];
    };

    getCurrentServerId = () => {
        return this.currentServerId;
    };

    getServerLog = (serverId: string, ...additionalPrefixes: string[]) => {
        const server = this.getServer(serverId);
        if (!server) {
            return new Logger(serverId);
        }
        return new Logger(...additionalPrefixes, ...this.includeId(serverId, server.name));
    };

    getRemoteInfo = (serverId: string) => {
        return this.remoteInfo.get(serverId);
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

    addServer = (server: Server, initialLoadURL?: URL) => {
        log.debug('addServer', server, initialLoadURL);

        const mattermostServer = this.createServer(server, false, initialLoadURL);
        this.addServerToMap(mattermostServer, true);
    };

    private createServer = (server: Server, isPredefined: boolean, initialLoadURL?: URL) => {
        let newServer = new MattermostServer(server, isPredefined, initialLoadURL);
        while (this.servers.has(newServer.id)) {
            newServer = new MattermostServer(server, isPredefined, initialLoadURL);
        }
        return newServer;
    };

    private addServerToMap = (newServer: MattermostServer, setAsCurrentServer: boolean) => {
        this.servers.set(newServer.id, newServer);
        if (!newServer.isPredefined) {
            this.serverOrder.push(newServer.id);
        }

        if (setAsCurrentServer) {
            this.currentServerId = newServer.id;
        }

        // Emit this event whenever we update a server URL to ensure remote info is fetched
        this.persistServers();
        this.emit(SERVER_ADDED, newServer.id, setAsCurrentServer);
        return newServer;
    };

    editServer = (serverId: string, server: Server) => {
        log.debug('editServer', serverId, server);

        const existingServer = this.servers.get(serverId);
        if (!existingServer) {
            log.warn('Server not found', serverId);
            return undefined;
        }

        if (existingServer.isPredefined) {
            log.warn('Cannot edit predefined server', existingServer.id);
            return existingServer;
        }

        const events: string[] = [];
        if (existingServer.url.toString() !== parseURL(server.url)?.toString()) {
            // Emit this event whenever we update a server URL to ensure remote info is fetched
            events.push(SERVER_URL_CHANGED);
        }
        if (existingServer.name !== server.name) {
            events.push(SERVER_NAME_CHANGED);
        }

        existingServer.name = server.name;
        existingServer.updateURL(server.url);
        this.servers.set(serverId, existingServer);

        this.persistServers();
        events.forEach((event) => this.emit(event, serverId));
        return existingServer;
    };

    updateRemoteInfo = (serverId: string, remoteInfo: RemoteInfo) => {
        log.debug('updateRemoteInfo', serverId, remoteInfo);

        const server = this.servers.get(serverId);
        if (!server) {
            return;
        }

        this.remoteInfo.set(serverId, remoteInfo);

        if (remoteInfo.siteURL && server.url.toString() !== new URL(remoteInfo.siteURL).toString()) {
            server.updateURL(remoteInfo.siteURL);
            this.servers.set(serverId, server);
            this.emit(SERVER_URL_CHANGED, serverId);
            this.persistServers();
        }
    };

    updateServerOrder = (serverOrder: string[]) => {
        log.debug('updateServerOrder', serverOrder);

        this.serverOrder = serverOrder.filter((id) => {
            const server = this.servers.get(id);
            return server && !server.isPredefined;
        });
        this.persistServers();
    };

    // Remove setCurrentServer method since we only need to persist changes when switching or removing servers
    updateCurrentServer = (serverId: string) => {
        log.debug('updateCurrentServer', serverId);

        if (this.currentServerId === serverId) {
            return;
        }

        this.currentServerId = serverId;
        this.emit(SERVER_SWITCHED, serverId);
        this.persistServers();
    };

    removeServer = (serverId: string) => {
        log.debug('removeServer', serverId);

        const index = this.serverOrder.findIndex((id) => id === serverId);
        this.serverOrder.splice(index, 1);
        this.remoteInfo.delete(serverId);
        this.servers.delete(serverId);

        // TODO: Change this to pick a server more intelligently
        if (this.currentServerId === serverId) {
            this.updateCurrentServer(this.serverOrder[0]);
        }

        this.emit(SERVER_REMOVED, serverId);
        this.persistServers();
    };

    init = () => {
        // Add the servers from the config
        let initialServers = [];
        Config.predefinedServers.forEach((server) => {
            initialServers.push(this.createServer(server, true));
        });
        if (Config.enableServerManagement) {
            initialServers.push(...Config.localServers.sort((a, b) => a.order - b.order).map((server) => this.createServer(server, false)));
        }
        initialServers = this.filterOutDuplicateServers(initialServers);

        // Set the current server based on config if the user last used a local server
        // Otherwise, just use the first server
        let currentServerIndex = Config.lastActiveServer ?? 0;
        if (Config.localServers.length && Config.predefinedServers.length) {
            currentServerIndex += Config.predefinedServers.length;
        } else if (Config.predefinedServers.length) {
            currentServerIndex = 0;
        }

        initialServers.forEach((server, index) => this.addServerToMap(server, currentServerIndex === index));

        // TODO: This should never happen, remove me after testing
        if (this.hasServers() && this.currentServerId === undefined) {
            throw new Error('No current server found');
        }
    };

    private filterOutDuplicateServers = (servers: MattermostServer[]) => {
        const uniqueServers = new Map<string, MattermostServer>();
        servers.forEach((server) => {
            if (!uniqueServers.has(`${server.name}:${server.url.toString()}`)) {
                uniqueServers.set(`${server.name}:${server.url.toString()}`, server);
            }
        });
        return [...uniqueServers.values()];
    };

    private persistServers = () => {
        const localServers = [...this.servers.values()].
            filter((srv) => !srv.isPredefined).map((srv) => ({
                name: srv.name,
                url: srv.url.toString(),
                order: this.serverOrder.indexOf(srv.id),
            }));
        Config.setServers(localServers, this.currentServerId ? this.serverOrder.indexOf(this.currentServerId) : undefined);
    };

    private includeId = (id: string, ...prefixes: string[]) => {
        const shouldInclude = ['debug', 'silly'].includes(getLevel());
        return shouldInclude ? [id, ...prefixes] : prefixes;
    };
}

const serverManager = new ServerManager();
export default serverManager;
