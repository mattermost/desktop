// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseURL, isInternalURL} from 'common/utils/url';
import Utils from 'common/utils/util';

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
});
