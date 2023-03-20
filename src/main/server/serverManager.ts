// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

import {IpcMainEvent, ipcMain} from 'electron';
import log from 'electron-log';

import {Team, ConfigTeam, ConfigTab} from 'types/config';
import {RemoteInfo} from 'types/server';

import Config from 'common/config';
import {
    SERVERS_UPDATE,
    UPDATE_SERVER_ORDER,
    UPDATE_TAB_ORDER,
    GET_LAST_ACTIVE,
    GET_ORDERED_SERVERS,
    GET_ORDERED_TABS_FOR_SERVER,
} from 'common/communication';
import {MattermostServer} from 'common/servers/MattermostServer';
import {TAB_FOCALBOARD, TAB_MESSAGING, TAB_PLAYBOOKS, TabView, getDefaultTabs} from 'common/tabs/TabView';
import urlUtils, {equalUrlsIgnoringSubpath} from 'common/utils/url';
import Utils from 'common/utils/util';

import {ServerInfo} from 'main/server/serverInfo';
import MessagingTabView from 'common/tabs/MessagingTabView';
import FocalboardTabView from 'common/tabs/FocalboardTabView';
import PlaybooksTabView from 'common/tabs/PlaybooksTabView';

export class ServerManager extends EventEmitter {
    servers: Map<string, MattermostServer>;
    serverInfos: Map<string, RemoteInfo>;
    serverOrder: string[];
    lastActiveServer?: string;

    tabs: Map<string, TabView>;
    tabOrder: Map<string, string[]>;
    lastActiveTab: Map<string, string>;

    constructor() {
        super();

        this.servers = new Map();
        this.serverInfos = new Map();
        this.serverOrder = [];
        this.tabs = new Map();
        this.tabOrder = new Map();
        this.lastActiveTab = new Map();
    }

    init = () => {
        log.debug('ServerManager.init');

        this.reloadFromConfig();

        ipcMain.on(UPDATE_SERVER_ORDER, this.updateServerOrder);
        ipcMain.on(UPDATE_TAB_ORDER, this.updateTabOrder);
        ipcMain.handle(GET_LAST_ACTIVE, this.handleGetLastActive);
        ipcMain.handle(GET_ORDERED_SERVERS, () => this.getOrderedServers().map((srv) => srv.toMattermostTeam()));
        ipcMain.handle(GET_ORDERED_TABS_FOR_SERVER, (event, serverId) => this.getOrderedTabsForServer(serverId).map((tab) => tab.toMattermostTab()));
    }

    private reloadFromConfig = () => {
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
            this.lastActiveServer = this.serverOrder[Config.lastActiveTeam];
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

    private handleGetLastActive = () => {
        const server = this.getLastActiveServer();
        const tab = this.getLastActiveTabForServer(server.id);
        return {server: server.id, tab: tab.id};
    }

    updateServerOrder = (event: IpcMainEvent, serverOrder: string[]) => {
        log.debug('ServerManager.updateServerOrder', serverOrder);

        this.serverOrder = serverOrder;
        this.persistServers();
    }

    updateTabOrder = (event: IpcMainEvent, serverId: string, tabOrder: string[]) => {
        log.verbose('ServerManager.updateTabOrder', serverId, tabOrder);

        this.tabOrder.set(serverId, tabOrder);
        this.persistServers();
    }

    private initServer = (team: ConfigTeam, isPredefined: boolean) => {
        const server = new MattermostServer(team, isPredefined);
        this.servers.set(server.id, server);

        log.debug('initialized server', server.name, server.id);

        const tabOrder: string[] = [];
        team.tabs.sort((a, b) => a.order - b.order).forEach((tab) => {
            const tabView = this.getTabView(server, tab.name, tab.isOpen);
            log.debug('initialized tab', server.name, tabView.name, tabView.id);

            this.tabs.set(tabView.id, tabView);
            tabOrder.push(tabView.id);
        });
        this.tabOrder.set(server.id, tabOrder);
        if (typeof team.lastActiveTab !== 'undefined') {
            this.lastActiveTab.set(server.id, tabOrder[team.lastActiveTab]);
        }
        return server.id;
    }

    getOrderedTabsForServer = (serverId: string) => {
        log.debug('ServerManager.getOrderedTabsForServer', serverId);

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
        log.debug('ServerManager.getOrderedServers');

        return this.serverOrder.reduce((servers, srv) => {
            const server = this.servers.get(srv);
            if (server) {
                servers.push(server);
            }
            return servers;
        }, [] as MattermostServer[]);
    }

    getLastActiveServer = () => {
        log.debug('ServerManager.getLastActiveServer');

        if (this.lastActiveServer) {
            const server = this.servers.get(this.lastActiveServer);
            if (server) {
                return server;
            }
        }
        const firstServer = this.servers.get(this.serverOrder[0]);
        if (!firstServer) {
            throw new Error('No servers exist');
        }
        return firstServer;
    }

    getLastActiveTabForServer = (serverId: string) => {
        log.debug('ServerManager.getLastActiveTabForServer', serverId);

        const lastActiveTab = this.lastActiveTab.get(serverId);
        if (lastActiveTab) {
            const tab = this.tabs.get(lastActiveTab);
            if (tab && tab?.isOpen) {
                return tab;
            }
        }
        return this.getFirstOpenTabForServer(serverId);
    }

    private getFirstOpenTabForServer = (serverId: string) => {
        const tabOrder = this.tabOrder.get(serverId);
        if (!tabOrder) {
            throw new Error(`Cannot find tabs for server id ${serverId}`);
        }
        const openTabs = this.getOrderedTabsForServer(serverId).filter((tab) => tab.isOpen);
        const firstTab = openTabs[0];
        if (!firstTab) {
            throw new Error(`No tabs open for server id ${serverId}`);
        }
        return firstTab;
    }

    getServer = (id: string) => {
        return this.servers.get(id);
    }

    getTab = (id: string) => {
        return this.tabs.get(id);
    }

    // TODO: Deprecate me
    getServerByName = (name: string) => {
        return this.getAllServers().find((srv) => srv.name === name);
    }

    // TODO: Deprecate me
    getTabByName = (serverId: string, type: string) => {
        return this.tabOrder.get(serverId)?.map((tabId) => this.tabs.get(tabId)).find((tab) => tab?.type === type);
    }

    getAllServers = () => {
        return [...this.servers.values()];
    }

    hasServers = () => {
        return Boolean(this.servers.size);
    }

    getRemoteInfo = (serverId: string) => {
        return this.serverInfos.get(serverId);
    }

    lookupTabByURL = (inputURL: URL | string, ignoreScheme = false) => {
        log.silly('ViewManager.getViewByURL', `${inputURL}`, ignoreScheme);

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

    private persistServers = (lastActiveTeam?: number) => {
        this.emit(SERVERS_UPDATE, this.getAllServers());

        const localServers = [...this.servers.values()].
            filter((server) => !server.isPredefined).
            map((server) => this.toConfigTeam(server));
        Config.setServers(localServers, lastActiveTeam);
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

    private toConfigTeam = (server: MattermostServer): ConfigTeam => {
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
        log.debug('ServerManager.getTabView', srv.name, tabName, isOpen);
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

    addServer = (server: Team) => {
        const newServer = new MattermostServer(server, false);
        this.servers.set(newServer.id, newServer);
        this.serverOrder.push(newServer.id);
        const tabOrder: string[] = [];
        getDefaultTabs().forEach((tab) => {
            const newTab = this.getTabView(newServer, tab.name, tab.isOpen);
            this.tabs.set(newTab.id, newTab);
            tabOrder.push(newTab.id);
        });
        this.tabOrder.set(newServer.id, tabOrder);
        this.persistServers();
        this.updateServerInfos([newServer.id]);
        return newServer;
    }

    editServer = (serverId: string, server: Team) => {
        const existingServer = this.servers.get(serverId);
        if (!existingServer) {
            return;
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

        this.persistServers();
        this.updateServerInfos([existingServer.id]);
    }

    removeServer = (serverId: string) => {
        this.tabOrder.get(serverId)?.forEach((tabId) => this.tabs.delete(tabId));
        this.tabOrder.delete(serverId);
        this.lastActiveTab.delete(serverId);

        const index = this.serverOrder.findIndex((id) => id === serverId);
        this.serverOrder.splice(index, 1);
        this.servers.delete(serverId);

        this.persistServers();
    }

    toggleTab = (tabId: string, isOpen: boolean) => {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            log.warn(`Could not find a tab with id ${tabId}`);
            return;
        }
        tab.isOpen = isOpen;
        this.persistServers();
    }

    updateLastActive = (tabId: string) => {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            log.warn(`Could not find a tab with id ${tabId}`);
            return;
        }
        this.lastActiveTab.set(tab.server.id, tabId);

        this.lastActiveServer = tab.server.id;

        const serverOrder = this.serverOrder.findIndex((srv) => srv === tab.server.id);
        this.persistServers(serverOrder);
    }

    updateServerInfos = (serverIds: string[]) => {
        log.debug('ServerManager.updateServerInfos', serverIds);

        const serverInfos: Array<Promise<{id: string; data: RemoteInfo | string | undefined}>> = [];
        serverIds.forEach((id) => {
            const server = this.servers.get(id);
            if (server) {
                const serverInfo = new ServerInfo(server);
                serverInfos.push(serverInfo.promise.then((data) => ({id, data})));
            }
        });
        return Promise.all(serverInfos).then((data: Array<{id: string; data: RemoteInfo | string | undefined}>) => {
            let hasUpdates = false;
            data.forEach((result) => {
                if (result.data && typeof result.data !== 'string') {
                    this.serverInfos.set(result.id, result.data);
                    hasUpdates = this.updateServerURL(result.id, result.data) || hasUpdates;
                    hasUpdates = this.openExtraTabs(result.id, result.data) || hasUpdates;
                }
            });
            if (hasUpdates) {
                this.persistServers();
            }
        }).catch((reason: Error) => {
            log.error('Error getting server infos', reason);
        });
    }

    private updateServerURL = (serverId: string, data: RemoteInfo) => {
        const server = this.servers.get(serverId);
        if (server && data.siteURL && `${server.url}` !== data.siteURL) {
            server.updateURL(data.siteURL);
            this.servers.set(serverId, server);
            return true;
        }
        return false;
    }

    private openExtraTabs = (serverId: string, data: RemoteInfo) => {
        let hasUpdates = false;
        if (!(data.serverVersion && Utils.isVersionGreaterThanOrEqualTo(data.serverVersion, '6.0.0'))) {
            return false;
        }
        const server = this.servers.get(serverId);
        const tabOrder = this.tabOrder.get(serverId);
        if (tabOrder) {
            tabOrder.forEach((tabId) => {
                const tab = this.tabs.get(tabId);
                if (tab) {
                    if (tab.name === TAB_PLAYBOOKS && data.hasPlaybooks && typeof tab.isOpen === 'undefined') {
                        log.info(`opening ${server?.name}___${tab.name} on hasPlaybooks`);
                        tab.isOpen = true;
                        this.tabs.set(tabId, tab);
                        hasUpdates = true;
                    }
                    if (tab.name === TAB_FOCALBOARD && data.hasFocalboard && typeof tab.isOpen === 'undefined') {
                        log.info(`opening ${server?.name}___${tab.name} on hasFocalboard`);
                        tab.isOpen = true;
                        this.tabs.set(tabId, tab);
                        hasUpdates = true;
                    }
                }
            });
        }
        return hasUpdates;
    }
}

const serverManager = new ServerManager();
export default serverManager;
