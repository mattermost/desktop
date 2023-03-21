// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TAB_MESSAGING, TAB_FOCALBOARD, TAB_PLAYBOOKS} from 'common/tabs/TabView';
import urlUtils, {equalUrlsIgnoringSubpath} from 'common/utils/url';
import Utils from 'common/utils/util';

import {ServerInfo} from 'main/server/serverInfo';

import {ServerManager} from './serverManager';

jest.mock('common/config', () => ({
    set: jest.fn(),
}));
jest.mock('common/utils/url', () => ({
    parseURL: jest.fn(),
    equalUrlsIgnoringSubpath: jest.fn(),
}));
jest.mock('common/utils/util', () => ({
    isVersionGreaterThanOrEqualTo: jest.fn(),
}));
jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));

describe('main/server/serverManager', () => {
    describe('updateServerInfos', () => {
        const serverManager = new ServerManager();

        beforeEach(() => {
            const server = {id: 'server-1', url: new URL('http://server-1.com')};
            server.updateURL = (url) => {
                server.url = new URL(url);
            };
            serverManager.servers = new Map([['server-1', server]]);
            serverManager.tabs = new Map([
                ['tab-1', {id: 'tab-1', name: TAB_MESSAGING, isOpen: true}],
                ['tab-2', {id: 'tab-2', name: TAB_PLAYBOOKS}],
                ['tab-3', {id: 'tab-3', name: TAB_FOCALBOARD}],
            ]);
            serverManager.tabOrder = new Map([['server-1', ['tab-1', 'tab-2', 'tab-3']]]);
            Utils.isVersionGreaterThanOrEqualTo.mockImplementation((version) => version === '6.0.0');
        });

        it('should open all tabs', async () => {
            ServerInfo.mockReturnValue({promise: Promise.resolve({
                id: 'server-1',
                siteURL: 'http://server-1.com',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            })});

            await serverManager.updateServerInfos(['server-1']);
            console.log('peepee');

            expect(serverManager.tabs.get('tab-2').isOpen).toBe(true);
            expect(serverManager.tabs.get('tab-3').isOpen).toBe(true);
        });

        it('should open only playbooks', async () => {
            ServerInfo.mockReturnValue({promise: Promise.resolve({
                id: 'server-1',
                siteURL: 'http://server-1.com',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: false,
            })});

            await serverManager.updateServerInfos(['server-1']);

            expect(serverManager.tabs.get('tab-2').isOpen).toBe(true);
            expect(serverManager.tabs.get('tab-3').isOpen).toBeUndefined();
        });

        it('should open none when server version is too old', async () => {
            ServerInfo.mockReturnValue({promise: Promise.resolve({
                id: 'server-1',
                siteURL: 'http://server-1.com',
                serverVersion: '5.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            })});

            await serverManager.updateServerInfos(['server-1']);

            expect(serverManager.tabs.get('tab-2').isOpen).toBeUndefined();
            expect(serverManager.tabs.get('tab-3').isOpen).toBeUndefined();
        });

        it('should update server URL using site URL', async () => {
            ServerInfo.mockReturnValue({promise: Promise.resolve({
                id: 'server-1',
                siteURL: 'http://server-2.com',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            })});

            await serverManager.updateServerInfos(['server-1']);

            expect(serverManager.servers.get('server-1').url.toString()).toBe('http://server-2.com/');
        });
    });

    describe('lookupTabByURL', () => {
        const serverManager = new ServerManager();
        serverManager.getAllServers = () => [
            {id: 'server-1', url: new URL('http://server-1.com')},
            {id: 'server-2', url: new URL('http://server-2.com/subpath')},
        ];
        serverManager.getOrderedTabsForServer = (serverId) => {
            if (serverId === 'server-1') {
                return [
                    {id: 'tab-1', url: new URL('http://server-1.com')},
                    {id: 'tab-1-type-1', url: new URL('http://server-1.com/type1')},
                    {id: 'tab-1-type-2', url: new URL('http://server-1.com/type2')},
                ];
            }
            if (serverId === 'server-2') {
                return [
                    {id: 'tab-2', url: new URL('http://server-2.com/subpath')},
                    {id: 'tab-2-type-1', url: new URL('http://server-2.com/subpath/type1')},
                    {id: 'tab-2-type-2', url: new URL('http://server-2.com/subpath/type2')},
                ];
            }
            return [];
        };

        beforeEach(() => {
            urlUtils.parseURL.mockImplementation((url) => new URL(url));
            equalUrlsIgnoringSubpath.mockImplementation((url1, url2) => `${url1}`.startsWith(`${url2}`));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should match the correct server - base URL', () => {
            const inputURL = new URL('http://server-1.com');
            expect(serverManager.lookupTabByURL(inputURL)).toStrictEqual({id: 'tab-1', url: new URL('http://server-1.com')});
        });

        it('should match the correct server - base tab', () => {
            const inputURL = new URL('http://server-1.com/team');
            expect(serverManager.lookupTabByURL(inputURL)).toStrictEqual({id: 'tab-1', url: new URL('http://server-1.com')});
        });

        it('should match the correct server - different tab', () => {
            const inputURL = new URL('http://server-1.com/type1/app');
            expect(serverManager.lookupTabByURL(inputURL)).toStrictEqual({id: 'tab-1-type-1', url: new URL('http://server-1.com/type1')});
        });

        it('should return undefined for server with subpath and URL without', () => {
            const inputURL = new URL('http://server-2.com');
            expect(serverManager.lookupTabByURL(inputURL)).toBe(undefined);
        });

        it('should return undefined for server with subpath and URL with wrong subpath', () => {
            const inputURL = new URL('http://server-2.com/different/subpath');
            expect(serverManager.lookupTabByURL(inputURL)).toBe(undefined);
        });

        it('should match the correct server with a subpath - base URL', () => {
            const inputURL = new URL('http://server-2.com/subpath');
            expect(serverManager.lookupTabByURL(inputURL)).toStrictEqual({id: 'tab-2', url: new URL('http://server-2.com/subpath')});
        });

        it('should match the correct server with a subpath - base tab', () => {
            const inputURL = new URL('http://server-2.com/subpath/team');
            expect(serverManager.lookupTabByURL(inputURL)).toStrictEqual({id: 'tab-2', url: new URL('http://server-2.com/subpath')});
        });

        it('should match the correct server with a subpath - different tab', () => {
            const inputURL = new URL('http://server-2.com/subpath/type2/team');
            expect(serverManager.lookupTabByURL(inputURL)).toStrictEqual({id: 'tab-2-type-2', url: new URL('http://server-2.com/subpath/type2')});
        });

        it('should return undefined for wrong server', () => {
            const inputURL = new URL('http://server-3.com');
            expect(serverManager.lookupTabByURL(inputURL)).toBe(undefined);
        });
    });
});
