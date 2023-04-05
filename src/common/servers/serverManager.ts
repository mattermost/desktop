// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

import {Team, ConfigServer, ConfigTab} from 'types/config';
import {RemoteInfo} from 'types/server';

import Config from 'common/config';
import {
    SERVERS_URL_MODIFIED,
    SERVERS_UPDATE,
} from 'common/communication';
import {Logger, getLevel} from 'common/log';
import {MattermostServer} from 'common/servers/MattermostServer';
import {TAB_FOCALBOARD, TAB_MESSAGING, TAB_PLAYBOOKS, TabView, getDefaultTabs} from 'common/tabs/TabView';
import MessagingTabView from 'common/tabs/MessagingTabView';
import FocalboardTabView from 'common/tabs/FocalboardTabView';
import PlaybooksTabView from 'common/tabs/PlaybooksTabView';
import urlUtils, {equalUrlsIgnoringSubpath} from 'common/utils/url';
import Utils from 'common/utils/util';

const log = new Logger('ServerManager');

export class ServerManager extends EventEmitter {
    private servers: Map<string, MattermostServer>;
    private remoteInfo: Map<string, RemoteInfo>;
    private serverOrder: string[];
    private currentServerId?: string;

    private tabs: Map<string, TabView>;
    private tabOrder: Map<string, string[]>;
    private lastActiveTab: Map<string, string>;

    constructor() {
        super();

        this.servers = new Map();
        this.remoteInfo = new Map();
        this.serverOrder = [];
        this.tabs = new Map();
        this.tabOrder = new Map();
        this.lastActiveTab = new Map();
    }

    getOrderedTabsForServer = (serverId: string) => {
        this.getServerLog(serverId, 'ServerManager').debug('getOrderedTabsForServer');

        const tabOrder = this.tabOrder.get(serverId);
        if (!tabOrder) {
            return [];
        }
        return tabOrder.reduce((tabs, tabId) => {
            const tab = this.tabs.get(tabId);
            if (tab) {
                tabs.push(tab);
            }
            return tabs;
        }, [] as TabView[]);
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
    }

    getCurrentServer = () => {
        log.debug('getCurrentServer');

        if (!this.currentServerId) {
            throw new Error('No server set as current');
        }
        const server = this.servers.get(this.currentServerId);
        if (!server) {
            throw new Error('Current server does not exist');
        }
        return server;
    }

    getLastActiveTabForServer = (serverId: string) => {
        this.getServerLog(serverId, 'ServerManager').debug('getLastActiveTabForServer');

        const lastActiveTab = this.lastActiveTab.get(serverId);
        if (lastActiveTab) {
            const tab = this.tabs.get(lastActiveTab);
            if (tab && tab?.isOpen) {
                return tab;
            }
        }
        return this.getFirstOpenTabForServer(serverId);
    }

    getServer = (id: string) => {
        return this.servers.get(id);
    }

    getTab = (id: string) => {
        return this.tabs.get(id);
    }

    getAllServers = () => {
        return [...this.servers.values()];
    }

    hasServers = () => {
        return Boolean(this.servers.size);
    }

    getRemoteInfo = (serverId: string) => {
        return this.remoteInfo.get(serverId);
    }

    updateRemoteInfos = (remoteInfos: Map<string, RemoteInfo>) => {
        let hasUpdates = false;
        remoteInfos.forEach((remoteInfo, serverId) => {
            this.remoteInfo.set(serverId, remoteInfo);
            hasUpdates = this.updateServerURL(serverId) || hasUpdates;
            hasUpdates = this.openExtraTabs(serverId) || hasUpdates;
        });

        if (hasUpdates) {
            this.persistServers();
        }
    }

    lookupTabByURL = (inputURL: URL | string, ignoreScheme = false) => {
        log.silly('lookupTabByURL', `${inputURL}`, ignoreScheme);

        const parsedURL = urlUtils.parseURL(inputURL);
        if (!parsedURL) {
            return undefined;
        }
        const server = this.getAllServers().find((server) => {
            return equalUrlsIgnoringSubpath(parsedURL, server.url, ignoreScheme) && parsedURL.pathname.match(new RegExp(`^${server.url.pathname}(.+)?(/(.+))?$`));
        });
        if (!server) {
            return undefined;
        }
        const tabs = this.getOrderedTabsForServer(server.id);

        let selectedTab = tabs.find((tab) => tab && tab.name === TAB_MESSAGING);
        tabs.
            filter((tab) => tab && tab.name !== TAB_MESSAGING).
            forEach((tab) => {
                if (parsedURL.pathname.match(new RegExp(`^${tab.url.pathname}(/(.+))?`))) {
                    selectedTab = tab;
                }
            });
        return selectedTab;
    }

    updateServerOrder = (serverOrder: string[]) => {
        log.debug('updateServerOrder', serverOrder);

        this.serverOrder = serverOrder;
        this.persistServers();
    }

    updateTabOrder = (serverId: string, tabOrder: string[]) => {
        this.getServerLog(serverId, 'ServerManager').debug('updateTabOrder', tabOrder);

        this.tabOrder.set(serverId, tabOrder);
        this.persistServers();
    }

    addServer = (server: Team) => {
        const newServer = new MattermostServer(server, false);

        if (this.servers.has(newServer.id)) {
            throw new Error('ID Collision detected. Cannot add server.');
        }
        this.servers.set(newServer.id, newServer);

        this.serverOrder.push(newServer.id);
        const tabOrder: string[] = [];
        getDefaultTabs().forEach((tab) => {
            const newTab = this.getTabView(newServer, tab.name, tab.isOpen);
            this.tabs.set(newTab.id, newTab);
            tabOrder.push(newTab.id);
        });
        this.tabOrder.set(newServer.id, tabOrder);

        // Emit this event whenever we update a server URL to ensure remote info is fetched
        this.emit(SERVERS_URL_MODIFIED, [newServer.id]);
        this.persistServers();
        return newServer;
    }

    editServer = (serverId: string, server: Team) => {
        const existingServer = this.servers.get(serverId);
        if (!existingServer) {
            return;
        }

        let urlModified;
        if (existingServer.url.toString() !== urlUtils.parseURL(server.url)?.toString()) {
            // Emit this event whenever we update a server URL to ensure remote info is fetched
            urlModified = () => this.emit(SERVERS_URL_MODIFIED, [serverId]);
        }
        existingServer.name = server.name;
        existingServer.updateURL(server.url);
        this.servers.set(serverId, existingServer);

        this.tabOrder.get(serverId)?.forEach((tabId) => {
            const tab = this.tabs.get(tabId);
            if (tab) {
                tab.server = existingServer;
                this.tabs.set(tabId, tab);
            }
        });

        urlModified?.();
        this.persistServers();
    }

    removeServer = (serverId: string) => {
        this.tabOrder.get(serverId)?.forEach((tabId) => this.tabs.delete(tabId));
        this.tabOrder.delete(serverId);
        this.lastActiveTab.delete(serverId);

        const index = this.serverOrder.findIndex((id) => id === serverId);
        this.serverOrder.splice(index, 1);
        this.remoteInfo.delete(serverId);
        this.servers.delete(serverId);

        this.persistServers();
    }

    setTabIsOpen = (tabId: string, isOpen: boolean) => {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            return;
        }
        tab.isOpen = isOpen;

        this.persistServers();
    }

    updateLastActive = (tabId: string) => {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            return;
        }
        this.lastActiveTab.set(tab.server.id, tabId);

        this.currentServerId = tab.server.id;

        const serverOrder = this.serverOrder.findIndex((srv) => srv === tab.server.id);
        if (serverOrder < 0) {
            throw new Error('Server order corrupt, ID not found.');
        }

        this.persistServers(serverOrder);
    }

    reloadFromConfig = () => {
        const serverOrder: string[] = [];
        Config.predefinedTeams.forEach((team) => {
            const id = this.initServer(team, true);
            serverOrder.push(id);
        });
        if (Config.enableServerManagement) {
            Config.localTeams.sort((a, b) => a.order - b.order).forEach((team) => {
                const id = this.initServer(team, false);
                serverOrder.push(id);
            });
        }
        this.filterOutDuplicateTeams();
        this.serverOrder = serverOrder;
        if (Config.lastActiveTeam) {
            this.currentServerId = this.serverOrder[Config.lastActiveTeam];
        } else {
            this.currentServerId = this.serverOrder[0];
        }
    }

    private filterOutDuplicateTeams = () => {
        const servers = [...this.servers.keys()].map((key) => ({key, value: this.servers.get(key)!}));
        const uniqueServers = new Set();
        servers.forEach((server) => {
            if (uniqueServers.has(`${server.value.name}:${server.value.url}`)) {
                this.servers.delete(server.key);
            } else {
                uniqueServers.add(`${server.value.name}:${server.value.url}`);
            }
        });
    }

    private initServer = (team: ConfigServer, isPredefined: boolean) => {
        const server = new MattermostServer(team, isPredefined);
        this.servers.set(server.id, server);

        this.getServerLog(server.id, 'ServerManager').debug('initialized server');

        const tabOrder: string[] = [];
        team.tabs.sort((a, b) => a.order - b.order).forEach((tab) => {
            const tabView = this.getTabView(server, tab.name, tab.isOpen);
            this.getViewLog(tabView.id, 'ServerManager').debug('initialized tab');

            this.tabs.set(tabView.id, tabView);
            tabOrder.push(tabView.id);
        });
        this.tabOrder.set(server.id, tabOrder);
        if (typeof team.lastActiveTab !== 'undefined') {
            this.lastActiveTab.set(server.id, tabOrder[team.lastActiveTab]);
        }
        return server.id;
    }

    private getFirstOpenTabForServer = (serverId: string) => {
        const tabOrder = this.getOrderedTabsForServer(serverId);
        const openTabs = tabOrder.filter((tab) => tab.isOpen);
        const firstTab = openTabs[0];
        if (!firstTab) {
            throw new Error(`No tabs open for server id ${serverId}`);
        }
        return firstTab;
    }

    private persistServers = async (lastActiveTeam?: number) => {
        this.emit(SERVERS_UPDATE);

        const localServers = [...this.servers.values()].
            reduce((servers, srv) => {
                if (srv.isPredefined) {
                    return servers;
                }
                servers.push(this.toConfigServer(srv));
                return servers;
            }, [] as ConfigServer[]);
        await Config.setServers(localServers, lastActiveTeam);
    }

    private getLastActiveTab = (serverId: string) => {
        let lastActiveTab: number | undefined;
        if (this.lastActiveTab.has(serverId)) {
            const index = this.tabOrder.get(serverId)?.indexOf(this.lastActiveTab.get(serverId)!);
            if (typeof index !== 'undefined' && index >= 0) {
                lastActiveTab = index;
            }
        }
        return lastActiveTab;
    }

    private toConfigServer = (server: MattermostServer): ConfigServer => {
        return {
            name: server.name,
            url: `${server.url}`,
            order: this.serverOrder.indexOf(server.id),
            lastActiveTab: this.getLastActiveTab(server.id),
            tabs: this.tabOrder.get(server.id)?.reduce((tabs, tabId, index) => {
                const tab = this.tabs.get(tabId);
                if (!tab) {
                    return tabs;
                }
                tabs.push({
                    name: tab?.type,
                    order: index,
                    isOpen: tab.isOpen,
                });
                return tabs;
            }, [] as ConfigTab[]) ?? [],
        };
    }

    private getTabView = (srv: MattermostServer, tabName: string, isOpen?: boolean) => {
        switch (tabName) {
        case TAB_MESSAGING:
            return new MessagingTabView(srv, isOpen);
        case TAB_FOCALBOARD:
            return new FocalboardTabView(srv, isOpen);
        case TAB_PLAYBOOKS:
            return new PlaybooksTabView(srv, isOpen);
        default:
            throw new Error('Not implemeneted');
        }
    }

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
    }

    private openExtraTabs = (serverId: string) => {
        const server = this.servers.get(serverId);
        const remoteInfo = this.remoteInfo.get(serverId);

        if (!(server && remoteInfo)) {
            return false;
        }

        if (!(remoteInfo.serverVersion && Utils.isVersionGreaterThanOrEqualTo(remoteInfo.serverVersion, '6.0.0'))) {
            return false;
        }

        let hasUpdates = false;
        const tabOrder = this.tabOrder.get(serverId);
        if (tabOrder) {
            tabOrder.forEach((tabId) => {
                const tab = this.tabs.get(tabId);
                if (tab) {
                    if (tab.name === TAB_PLAYBOOKS && remoteInfo.hasPlaybooks && typeof tab.isOpen === 'undefined') {
                        this.getViewLog(tab.id, 'ServerManager').verbose('opening Playbooks');
                        tab.isOpen = true;
                        this.tabs.set(tabId, tab);
                        hasUpdates = true;
                    }
                    if (tab.name === TAB_FOCALBOARD && remoteInfo.hasFocalboard && typeof tab.isOpen === 'undefined') {
                        this.getViewLog(tab.id, 'ServerManager').verbose('opening Boards');
                        tab.isOpen = true;
                        this.tabs.set(tabId, tab);
                        hasUpdates = true;
                    }
                }
            });
        }
        return hasUpdates;
    }

    private includeId = (id: string, ...prefixes: string[]) => {
        const shouldInclude = ['debug', 'silly'].includes(getLevel());
        return shouldInclude ? [id, ...prefixes] : prefixes;
    };

    getServerLog = (serverId: string, ...additionalPrefixes: string[]) => {
        const server = this.getServer(serverId);
        if (!server) {
            return log.withPrefix(serverId);
        }
        return log.withPrefix(...additionalPrefixes, ...this.includeId(serverId, server.name));
    };

    getViewLog = (viewId: string, ...additionalPrefixes: string[]) => {
        const view = this.getTab(viewId);
        if (!view) {
            return log.withPrefix(viewId);
        }
        return log.withPrefix(...additionalPrefixes, ...this.includeId(viewId, view.server.name, view.name));
    };
}

const serverManager = new ServerManager();
export default serverManager;
