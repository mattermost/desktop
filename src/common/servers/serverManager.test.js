// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Config from 'common/config';
import {parseURL, isInternalURL} from 'common/utils/url';
import Utils from 'common/utils/util';

import {ServerManager} from './serverManager';

jest.mock('common/config', () => {
    const mock = {
        set: jest.fn(),
        predefinedServers: [],
        localServers: [],
        lastActiveServer: undefined,
        enableServerManagement: true,
        setServers: jest.fn(),
    };
    return {
        __esModule: true,
        default: mock,
    };
});
jest.mock('common/utils/url', () => ({
    parseURL: jest.fn(),
    isInternalURL: jest.fn(),
    getFormattedPathName: (pathname) => (pathname.endsWith('/') ? pathname : `${pathname}/`),
}));
jest.mock('common/utils/util', () => ({
    isVersionGreaterThanOrEqualTo: jest.fn(),
}));
jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));

describe('common/servers/serverManager', () => {
    describe('updateRemoteInfos', () => {
        const serverManager = new ServerManager();

        beforeEach(() => {
            const server = {id: 'server-1', url: new URL('http://server-1.com'), name: 'server-1'};
            server.updateURL = (url) => {
                server.url = new URL(url);
            };
            serverManager.servers = new Map([['server-1', server]]);
            serverManager.persistServers = jest.fn();
            Utils.isVersionGreaterThanOrEqualTo.mockImplementation((version) => version === '6.0.0');
        });

        it('should not save when there is nothing to update', () => {
            serverManager.updateRemoteInfo('server-1', {
                siteURL: 'http://server-1.com',
                serverVersion: '6.0.0',
                hasPlaybooks: false,
                hasFocalboard: false,
            });

            expect(serverManager.persistServers).not.toHaveBeenCalled();
        });

        it('should update server URL using site URL when validated', async () => {
            serverManager.updateRemoteInfo('server-1', {
                siteURL: 'http://server-2.com',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            }, true);

            expect(serverManager.servers.get('server-1').url.toString()).toBe('http://server-2.com/');
        });

        it('should not update server URL when site URL is not validated', async () => {
            serverManager.updateRemoteInfo('server-1', {
                siteURL: 'http://server-2.com',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            }, false);

            expect(serverManager.servers.get('server-1').url.toString()).toBe('http://server-1.com/');
            expect(serverManager.persistServers).not.toHaveBeenCalled();
        });
    });

    describe('lookupServerByURL', () => {
        const serverManager = new ServerManager();
        serverManager.getAllServers = () => [
            {id: 'server-1', url: new URL('http://server-1.com')},
            {id: 'server-2', url: new URL('http://server-2.com/subpath')},
        ];

        beforeEach(() => {
            parseURL.mockImplementation((url) => new URL(url));
            isInternalURL.mockImplementation((url1, url2) => `${url1}`.startsWith(`${url2}`));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should match the correct server - base URL', () => {
            const inputURL = new URL('http://server-1.com');
            expect(serverManager.lookupServerByURL(inputURL)).toStrictEqual({id: 'server-1', url: new URL('http://server-1.com')});
        });

        it('should match the correct server - base view', () => {
            const inputURL = new URL('http://server-1.com/server');
            expect(serverManager.lookupServerByURL(inputURL)).toStrictEqual({id: 'server-1', url: new URL('http://server-1.com')});
        });

        it('should match the correct server - different view', () => {
            const inputURL = new URL('http://server-1.com/type1/app');
            expect(serverManager.lookupServerByURL(inputURL)).toStrictEqual({id: 'server-1', url: new URL('http://server-1.com/type1')});
        });

        it('should return undefined for server with subpath and URL without', () => {
            const inputURL = new URL('http://server-2.com');
            expect(serverManager.lookupServerByURL(inputURL)).toBe(undefined);
        });

        it('should return undefined for server with subpath and URL with wrong subpath', () => {
            const inputURL = new URL('http://server-2.com/different/subpath');
            expect(serverManager.lookupServerByURL(inputURL)).toBe(undefined);
        });

        it('should match the correct server with a subpath - base URL', () => {
            const inputURL = new URL('http://server-2.com/subpath');
            expect(serverManager.lookupServerByURL(inputURL)).toStrictEqual({id: 'server-2', url: new URL('http://server-2.com/subpath')});
        });

        it('should not match a server where the subpaths are substrings of each other ', () => {
            const inputURL = new URL('http://server-2.com/subpath2');
            expect(serverManager.lookupServerByURL(inputURL)).toBe(undefined);
        });

        it('should match the correct server with a subpath - base view', () => {
            const inputURL = new URL('http://server-2.com/subpath/server');
            expect(serverManager.lookupServerByURL(inputURL)).toStrictEqual({id: 'server-2', url: new URL('http://server-2.com/subpath')});
        });

        it('should match the correct server with a subpath - different view', () => {
            const inputURL = new URL('http://server-2.com/subpath/type2/server');
            expect(serverManager.lookupServerByURL(inputURL)).toStrictEqual({id: 'server-2', url: new URL('http://server-2.com/subpath/type2')});
        });

        it('should return undefined for wrong server', () => {
            const inputURL = new URL('http://server-3.com');
            expect(serverManager.lookupServerByURL(inputURL)).toBe(undefined);
        });
    });

    describe('persistServers with predefined servers', () => {
        let serverManager;

        beforeEach(() => {
            Config.predefinedServers = [
                {name: 'Predefined Server 1', url: 'http://predefined-1.com'},
                {name: 'Predefined Server 2', url: 'http://predefined-2.com'},
            ];
            Config.localServers = [];
            Config.enableServerManagement = true;
            Config.lastActiveServer = undefined;
            Config.setServers.mockClear();

            parseURL.mockImplementation((url) => new URL(url));

            serverManager = new ServerManager();
            serverManager.init();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should always set lastActiveServer to at least 0 when there are predefined servers', () => {
            const localServer = {name: 'Local Server', url: 'http://local.com'};
            serverManager.addServer(localServer);
            serverManager.updateCurrentServer(serverManager.getOrderedServers()[0].id);
            expect(Config.setServers).toHaveBeenCalledWith(expect.any(Array), 0);
        });
    });

    describe('init with invalid lastActiveServer', () => {
        let serverManager;

        beforeEach(() => {
            parseURL.mockImplementation((url) => new URL(url));
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should set a current server even when lastActiveServer index is out of bounds', () => {
            Config.predefinedServers = [
                {name: 'Predefined Server 1', url: 'http://predefined-1.com'},
            ];
            Config.localServers = [
                {name: 'Local Server 1', url: 'http://local-1.com', order: 0},
            ];
            Config.enableServerManagement = true;
            Config.lastActiveServer = 10;

            serverManager = new ServerManager();
            serverManager.init();

            expect(serverManager.getCurrentServerId()).toBeDefined();
            const orderedServers = serverManager.getOrderedServers();
            expect(orderedServers.length).toBeGreaterThan(0);
            expect(orderedServers.some((s) => s.id === serverManager.getCurrentServerId())).toBe(true);
        });
    });

    describe('reloadServer', () => {
        let serverManager;

        beforeEach(() => {
            Config.predefinedServers = [];
            Config.localServers = [
                {name: 'Local Server 1', url: 'http://local-1.com', order: 0},
                {name: 'Local Server 2', url: 'http://local-2.com', order: 1},
                {name: 'Local Server 3', url: 'http://local-3.com', order: 2},
            ];
            Config.enableServerManagement = true;
            Config.lastActiveServer = 0;

            parseURL.mockImplementation((url) => new URL(url));

            serverManager = new ServerManager();
            serverManager.init();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should maintain the same order when reloading a user-configured server', () => {
            const orderedServers = serverManager.getOrderedServers();
            const serverToReload = orderedServers[1];
            const originalOrder = orderedServers.map((s) => s.id);

            serverManager.reloadServer(serverToReload.id);

            const newOrderedServers = serverManager.getOrderedServers();
            const newOrder = newOrderedServers.map((s) => s.id);

            expect(newOrder.length).toBe(originalOrder.length);
            const reloadedServer = newOrderedServers.find((s) => s.name === serverToReload.name);
            expect(reloadedServer).toBeDefined();
            const reloadedIndex = newOrder.indexOf(reloadedServer.id);
            expect(reloadedIndex).toBe(1);
        });
    });

    describe('removeServer', () => {
        let serverManager;

        beforeEach(() => {
            parseURL.mockImplementation((url) => new URL(url));
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should switch to previous server when removing a server, even with predefined servers', () => {
            Config.predefinedServers = [
                {name: 'Predefined Server 1', url: 'http://predefined-1.com'},
            ];
            Config.localServers = [
                {name: 'Local Server 1', url: 'http://local-1.com', order: 0},
                {name: 'Local Server 2', url: 'http://local-2.com', order: 1},
            ];
            Config.enableServerManagement = true;
            Config.lastActiveServer = 0;

            serverManager = new ServerManager();
            serverManager.init();

            const orderedServers = serverManager.getOrderedServers();
            const serverToRemove = orderedServers[2];
            const previousServer = orderedServers[1];

            serverManager.updateCurrentServer(serverToRemove.id);
            expect(serverManager.getCurrentServerId()).toBe(serverToRemove.id);

            serverManager.removeServer(serverToRemove.id);

            expect(serverManager.getCurrentServerId()).toBe(previousServer.id);
        });

        it('should switch to next server when removing first server and no previous exists', () => {
            Config.predefinedServers = [
                {name: 'Predefined Server 1', url: 'http://predefined-1.com'},
            ];
            Config.localServers = [
                {name: 'Local Server 1', url: 'http://local-1.com', order: 0},
            ];
            Config.enableServerManagement = true;
            Config.lastActiveServer = 0;

            serverManager = new ServerManager();
            serverManager.init();

            const orderedServers = serverManager.getOrderedServers();
            const firstServer = orderedServers[0];
            const nextServer = orderedServers[1];

            serverManager.updateCurrentServer(firstServer.id);
            expect(serverManager.getCurrentServerId()).toBe(firstServer.id);

            serverManager.removeServer(firstServer.id);

            expect(serverManager.getCurrentServerId()).toBe(nextServer.id);
        });
    });

    describe('reordering with predefined servers', () => {
        let serverManager;

        beforeEach(() => {
            Config.predefinedServers = [
                {name: 'Predefined 1', url: 'http://predefined-1.com'},
                {name: 'Predefined 2', url: 'http://predefined-2.com'},
            ];
            Config.localServers = [
                {name: 'Local 1', url: 'http://local-1.com', order: 0},
            ];
            Config.enableServerManagement = true;
            Config.lastActiveServer = 0;
            Config.setServers.mockClear();
            parseURL.mockImplementation((url) => new URL(url));

            serverManager = new ServerManager();
            serverManager.init();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should allow reordering so predefined servers can move in the list', () => {
            const ordered = serverManager.getOrderedServers();
            expect(ordered.length).toBe(3);
            const ids = ordered.map((s) => s.id);
            const reversed = [...ids].reverse();
            serverManager.updateServerOrder(reversed);
            const afterReorder = serverManager.getOrderedServers().map((s) => s.id);
            expect(afterReorder).toEqual(reversed);
            expect(Config.setServers).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({name: 'Predefined 1', url: 'http://predefined-1.com/', isPredefined: true}),
                    expect.objectContaining({name: 'Predefined 2', url: 'http://predefined-2.com/', isPredefined: true}),
                    expect.objectContaining({name: 'Local 1', url: 'http://local-1.com/', isPredefined: false}),
                ]),
                expect.any(Number),
            );
        });
    });

    describe('predefined and non-predefined server with same URL', () => {
        let serverManager;

        beforeEach(() => {
            parseURL.mockImplementation((url) => new URL(url));
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should keep predefined server and drop non-predefined when URLs match', () => {
            const sameUrl = 'http://same-url.com';
            Config.predefinedServers = [
                {name: 'Predefined', url: sameUrl},
            ];
            Config.localServers = [
                {name: 'User Added Same', url: sameUrl, order: 0, isPredefined: false},
            ];
            Config.enableServerManagement = true;
            Config.lastActiveServer = 0;

            serverManager = new ServerManager();
            serverManager.init();

            const ordered = serverManager.getOrderedServers();
            expect(ordered.length).toBe(1);
            expect(ordered[0].name).toBe('Predefined');
            expect(ordered[0].isPredefined).toBe(true);
        });
    });

    describe('init load order from config', () => {
        let serverManager;

        beforeEach(() => {
            Config.predefinedServers = [];
            Config.enableServerManagement = true;
            Config.lastActiveServer = 0;
            parseURL.mockImplementation((url) => new URL(url));
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should order local servers by config order field', () => {
            Config.localServers = [
                {name: 'Third', url: 'http://third.com', order: 2},
                {name: 'First', url: 'http://first.com', order: 0},
                {name: 'Second', url: 'http://second.com', order: 1},
            ];

            serverManager = new ServerManager();
            serverManager.init();

            const names = serverManager.getOrderedServers().map((s) => s.name);
            expect(names).toEqual(['First', 'Second', 'Third']);
        });

        it('should put unordered predefined first then rest by order', () => {
            Config.predefinedServers = [
                {name: 'Predefined Only', url: 'http://predefined-only.com'},
            ];
            Config.localServers = [
                {name: 'Local Second', url: 'http://local-2.com', order: 1, isPredefined: false},
                {name: 'Local First', url: 'http://local-1.com', order: 0, isPredefined: false},
            ];

            serverManager = new ServerManager();
            serverManager.init();

            const names = serverManager.getOrderedServers().map((s) => s.name);
            expect(names[0]).toBe('Predefined Only');
            expect(names.slice(1)).toEqual(['Local First', 'Local Second']);
        });

        it('should order predefined-in-local by their order field with non-predefined', () => {
            Config.predefinedServers = [
                {name: 'Predefined A', url: 'http://predefined-a.com'},
                {name: 'Predefined B', url: 'http://predefined-b.com'},
            ];
            Config.localServers = [
                {name: 'Predefined B', url: 'http://predefined-b.com', order: 1, isPredefined: true},
                {name: 'Local', url: 'http://local.com', order: 2, isPredefined: false},
                {name: 'Predefined A', url: 'http://predefined-a.com', order: 0, isPredefined: true},
            ];

            serverManager = new ServerManager();
            serverManager.init();

            const names = serverManager.getOrderedServers().map((s) => s.name);
            expect(names).toEqual(['Predefined A', 'Predefined B', 'Local']);
        });

        it('should keep predefined servers when URLs match and should override name with predefined name', () => {
            Config.predefinedServers = [
                {name: 'Predefined', url: 'http://predefined.com'},
                {name: 'Predefined 2', url: 'http://predefined2.com'},
            ];
            Config.localServers = [
                {name: 'Predefined Local', url: 'http://predefined2.com', order: 1, isPredefined: true},
                {name: 'Local', url: 'http://predefined.com', order: 0, isPredefined: false},
            ];

            Config.enableServerManagement = true;
            Config.lastActiveServer = 0;

            serverManager = new ServerManager();
            serverManager.init();

            const names = serverManager.getOrderedServers().map((s) => s.name);
            expect(names).toEqual(['Predefined', 'Predefined 2']);
        });
    });
});
