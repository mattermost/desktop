// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseURL, isInternalURL} from 'common/utils/url';
import Utils from 'common/utils/util';
import {TAB_MESSAGING, TAB_FOCALBOARD, TAB_PLAYBOOKS} from 'common/views/View';

import {ServerManager} from './serverManager';

jest.mock('common/config', () => ({
    set: jest.fn(),
}));
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
            serverManager.views = new Map([
                ['view-1', {id: 'view-1', type: TAB_MESSAGING, isOpen: true, server}],
                ['view-2', {id: 'view-2', type: TAB_PLAYBOOKS, server}],
                ['view-3', {id: 'view-3', type: TAB_FOCALBOARD, server}],
            ]);
            serverManager.viewOrder = new Map([['server-1', ['view-1', 'view-2', 'view-3']]]);
            serverManager.persistServers = jest.fn();
            Utils.isVersionGreaterThanOrEqualTo.mockImplementation((version) => version === '6.0.0');
        });

        it('should not save when there is nothing to update', () => {
            serverManager.updateRemoteInfos(new Map([['server-1', {
                siteURL: 'http://server-1.com',
                serverVersion: '6.0.0',
                hasPlaybooks: false,
                hasFocalboard: false,
            }]]));

            expect(serverManager.persistServers).not.toHaveBeenCalled();
        });

        it('should update server URL using site URL', async () => {
            serverManager.updateRemoteInfos(new Map([['server-1', {
                siteURL: 'http://server-2.com',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            }]]));

            expect(serverManager.servers.get('server-1').url.toString()).toBe('http://server-2.com/');
        });
    });

    describe('lookupViewByURL', () => {
        const serverManager = new ServerManager();
        serverManager.getAllServers = () => [
            {id: 'server-1', url: new URL('http://server-1.com')},
            {id: 'server-2', url: new URL('http://server-2.com/subpath')},
        ];
        serverManager.getOrderedTabsForServer = (serverId) => {
            if (serverId === 'server-1') {
                return [
                    {id: 'view-1', url: new URL('http://server-1.com')},
                    {id: 'view-1-type-1', url: new URL('http://server-1.com/type1')},
                    {id: 'view-1-type-2', url: new URL('http://server-1.com/type2')},
                ];
            }
            if (serverId === 'server-2') {
                return [
                    {id: 'view-2', url: new URL('http://server-2.com/subpath')},
                    {id: 'view-2-type-1', url: new URL('http://server-2.com/subpath/type1')},
                    {id: 'view-2-type-2', url: new URL('http://server-2.com/subpath/type2')},
                ];
            }
            return [];
        };

        beforeEach(() => {
            parseURL.mockImplementation((url) => new URL(url));
            isInternalURL.mockImplementation((url1, url2) => `${url1}`.startsWith(`${url2}`));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should match the correct server - base URL', () => {
            const inputURL = new URL('http://server-1.com');
            expect(serverManager.lookupViewByURL(inputURL)).toStrictEqual({id: 'view-1', url: new URL('http://server-1.com')});
        });

        it('should match the correct server - base view', () => {
            const inputURL = new URL('http://server-1.com/server');
            expect(serverManager.lookupViewByURL(inputURL)).toStrictEqual({id: 'view-1', url: new URL('http://server-1.com')});
        });

        it('should match the correct server - different view', () => {
            const inputURL = new URL('http://server-1.com/type1/app');
            expect(serverManager.lookupViewByURL(inputURL)).toStrictEqual({id: 'view-1-type-1', url: new URL('http://server-1.com/type1')});
        });

        it('should return undefined for server with subpath and URL without', () => {
            const inputURL = new URL('http://server-2.com');
            expect(serverManager.lookupViewByURL(inputURL)).toBe(undefined);
        });

        it('should return undefined for server with subpath and URL with wrong subpath', () => {
            const inputURL = new URL('http://server-2.com/different/subpath');
            expect(serverManager.lookupViewByURL(inputURL)).toBe(undefined);
        });

        it('should match the correct server with a subpath - base URL', () => {
            const inputURL = new URL('http://server-2.com/subpath');
            expect(serverManager.lookupViewByURL(inputURL)).toStrictEqual({id: 'view-2', url: new URL('http://server-2.com/subpath')});
        });

        it('should not match a server where the subpaths are substrings of each other ', () => {
            const inputURL = new URL('http://server-2.com/subpath2');
            expect(serverManager.lookupViewByURL(inputURL)).toBe(undefined);
        });

        it('should match the correct server with a subpath - base view', () => {
            const inputURL = new URL('http://server-2.com/subpath/server');
            expect(serverManager.lookupViewByURL(inputURL)).toStrictEqual({id: 'view-2', url: new URL('http://server-2.com/subpath')});
        });

        it('should match the correct server with a subpath - different view', () => {
            const inputURL = new URL('http://server-2.com/subpath/type2/server');
            expect(serverManager.lookupViewByURL(inputURL)).toStrictEqual({id: 'view-2-type-2', url: new URL('http://server-2.com/subpath/type2')});
        });

        it('should return undefined for wrong server', () => {
            const inputURL = new URL('http://server-3.com');
            expect(serverManager.lookupViewByURL(inputURL)).toBe(undefined);
        });
    });
});
