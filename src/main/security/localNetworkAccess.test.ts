// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WebContents} from 'electron';

import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';

import localNetworkAccessManager, {LocalNetworkAccessManager} from './localNetworkAccess';

jest.mock('common/servers/serverManager', () => ({
    getAllServers: jest.fn(),
}));

describe('main/security/localNetworkAccess', () => {
    const emptyLookup = jest.fn().mockResolvedValue([]);
    const mockServerManager = jest.mocked(ServerManager);

    beforeEach(() => {
        emptyLookup.mockClear();
        localNetworkAccessManager.clear();
        mockServerManager.getAllServers.mockReturnValue([{url: new URL('http://127.0.0.1:8065')} as unknown as MattermostServer]);
    });

    describe('LocalNetworkAccessManager', () => {
        it('registers webContents and tracks monitored status', () => {
            const manager = new LocalNetworkAccessManager();
            const mockWebContents = {
                id: 10,
                isDestroyed: () => false,
            } as unknown as WebContents;

            manager.registerWebContents(mockWebContents);
            expect(manager.isMonitored(10)).toBe(true);
            expect(manager.isMonitored(20)).toBe(false);
        });

        it('does not register if webContents is already destroyed', () => {
            const manager = new LocalNetworkAccessManager();
            const mockWebContents = {
                id: 10,
                isDestroyed: () => true,
            } as unknown as WebContents;

            manager.registerWebContents(mockWebContents);
            expect(manager.isMonitored(10)).toBe(false);
        });

        it('unregisters webContents by id directly', () => {
            const manager = new LocalNetworkAccessManager();
            const mockWebContents = {
                id: 10,
                isDestroyed: () => false,
            } as unknown as WebContents;

            manager.registerWebContents(mockWebContents);
            expect(manager.isMonitored(10)).toBe(true);

            manager.unregisterWebContents(10);
            expect(manager.isMonitored(10)).toBe(false);
        });
    });

    describe('isLocalOrPrivateIPAddress', () => {
        it('detects IPv4 local and private ranges', () => {
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('127.0.0.1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('10.0.0.1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('172.16.0.1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('172.31.255.255')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('192.168.1.1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('169.254.169.254')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('8.8.8.8')).toBe(false);
        });

        it('detects IPv6 local and private ranges', () => {
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('::1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('fc00::1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('fd00::1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('fec0::1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('fe80::1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('::ffff:127.0.0.1')).toBe(true);
            expect(localNetworkAccessManager.isLocalOrPrivateIPAddress('2606:4700:4700::1111')).toBe(false);
        });
    });

    describe('shouldBlockLocalNetworkRequest', () => {
        it('blocks local hostnames and private IP literals', async () => {
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('http://localhost:3000', [], emptyLookup)).resolves.toBe(true);
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('http://127.0.0.1:3000', [], emptyLookup)).resolves.toBe(true);
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('http://192.168.1.10', [], emptyLookup)).resolves.toBe(true);
        });

        it('allows configured server origins even when they are local', async () => {
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest(
                'http://127.0.0.1:8065/api/v4/system/ping',
                [new URL('http://127.0.0.1:8065')],
                emptyLookup,
            )).resolves.toBe(false);

            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest(
                'http://localhost:8065/api/v4/system/ping',
                [new URL('http://localhost:8065/team')],
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('blocks hostnames that resolve to private addresses', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '10.0.0.5'}]);
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('http://printer.corp', [], lookup)).resolves.toBe(true);
        });

        it('allows public http targets and non-filtered protocols', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '8.8.8.8'}]);
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('https://mattermost.com', [], lookup)).resolves.toBe(false);
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('file:///etc/hosts', [], lookup)).resolves.toBe(false);
        });

        it('blocks WebSocket connections to local/private targets', async () => {
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('ws://127.0.0.1:8065/websocket', [], emptyLookup)).resolves.toBe(true);
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('wss://10.0.0.5/websocket', [], emptyLookup)).resolves.toBe(true);
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('ws://localhost:3000', [], emptyLookup)).resolves.toBe(true);
        });

        it('allows WebSocket connections to the configured server origin', async () => {
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest(
                'ws://127.0.0.1:8065/api/v4/websocket',
                [new URL('http://127.0.0.1:8065')],
                emptyLookup,
            )).resolves.toBe(false);

            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest(
                'wss://127.0.0.1:8065/api/v4/websocket',
                [new URL('https://127.0.0.1:8065')],
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('allows public WebSocket targets', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '8.8.8.8'}]);
            await expect(localNetworkAccessManager.shouldBlockLocalNetworkRequest('wss://realtime.example.com', [], lookup)).resolves.toBe(false);
        });
    });

    describe('shouldCancelLocalNetworkRequest', () => {
        beforeEach(() => {
            localNetworkAccessManager.registerWebContents({
                id: 1,
                isDestroyed: () => false,
            } as unknown as WebContents);
        });

        it('blocks server view requests using webContentsId', async () => {
            await expect(localNetworkAccessManager.shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                    webContentsId: 1,
                },
                emptyLookup,
            )).resolves.toBe(true);
        });

        it('allows configured server origins', async () => {
            await expect(localNetworkAccessManager.shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:8065/api/v4/system/ping',
                    webContentsId: 1,
                },
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('allows requests that belong to a known non-server web contents', async () => {
            await expect(localNetworkAccessManager.shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                    webContentsId: 2,
                },
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('blocks unowned requests to local/private targets', async () => {
            await expect(localNetworkAccessManager.shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                },
                emptyLookup,
            )).resolves.toBe(true);
        });

        it('allows unowned requests to the configured server origin', async () => {
            await expect(localNetworkAccessManager.shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:8065/api/v4/websocket',
                },
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('allows unowned requests to public targets', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '8.8.8.8'}]);
            await expect(localNetworkAccessManager.shouldCancelLocalNetworkRequest(
                {
                    url: 'https://mattermost.com',
                },
                lookup,
            )).resolves.toBe(false);
        });
    });
});
