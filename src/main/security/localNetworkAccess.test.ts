// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getRequestWebContentsId,
    isLocalOrPrivateIPAddress,
    shouldCancelLocalNetworkRequest,
    shouldBlockLocalNetworkRequest,
} from './localNetworkAccess';

describe('main/security/localNetworkAccess', () => {
    const emptyLookup = jest.fn().mockResolvedValue([]);

    beforeEach(() => {
        emptyLookup.mockClear();
    });

    describe('isLocalOrPrivateIPAddress', () => {
        it('detects IPv4 local and private ranges', () => {
            expect(isLocalOrPrivateIPAddress('127.0.0.1')).toBe(true);
            expect(isLocalOrPrivateIPAddress('10.0.0.1')).toBe(true);
            expect(isLocalOrPrivateIPAddress('172.16.0.1')).toBe(true);
            expect(isLocalOrPrivateIPAddress('172.31.255.255')).toBe(true);
            expect(isLocalOrPrivateIPAddress('192.168.1.1')).toBe(true);
            expect(isLocalOrPrivateIPAddress('169.254.169.254')).toBe(true);
            expect(isLocalOrPrivateIPAddress('8.8.8.8')).toBe(false);
        });

        it('detects IPv6 local and private ranges', () => {
            expect(isLocalOrPrivateIPAddress('::1')).toBe(true);
            expect(isLocalOrPrivateIPAddress('fc00::1')).toBe(true);
            expect(isLocalOrPrivateIPAddress('fd00::1')).toBe(true);
            expect(isLocalOrPrivateIPAddress('fe80::1')).toBe(true);
            expect(isLocalOrPrivateIPAddress('::ffff:127.0.0.1')).toBe(true);
            expect(isLocalOrPrivateIPAddress('2606:4700:4700::1111')).toBe(false);
        });
    });

    describe('shouldBlockLocalNetworkRequest', () => {
        it('blocks local hostnames and private IP literals', async () => {
            await expect(shouldBlockLocalNetworkRequest('http://localhost:3000', [], emptyLookup)).resolves.toBe(true);
            await expect(shouldBlockLocalNetworkRequest('http://127.0.0.1:3000', [], emptyLookup)).resolves.toBe(true);
            await expect(shouldBlockLocalNetworkRequest('http://192.168.1.10', [], emptyLookup)).resolves.toBe(true);
        });

        it('allows configured server origins even when they are local', async () => {
            await expect(shouldBlockLocalNetworkRequest(
                'http://127.0.0.1:8065/api/v4/system/ping',
                [new URL('http://127.0.0.1:8065')],
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('blocks hostnames that resolve to private addresses', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '10.0.0.5'}]);

            await expect(shouldBlockLocalNetworkRequest('http://internal.example.com', [], lookup)).resolves.toBe(true);
        });

        it('allows public http targets and non-filtered protocols', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '8.8.8.8'}]);

            await expect(shouldBlockLocalNetworkRequest('https://mattermost.com', [], lookup)).resolves.toBe(false);
            await expect(shouldBlockLocalNetworkRequest('mattermost-desktop://renderer/index.html', [], lookup)).resolves.toBe(false);
        });

        it('blocks WebSocket connections to local/private targets', async () => {
            await expect(shouldBlockLocalNetworkRequest('ws://127.0.0.1:9000', [], emptyLookup)).resolves.toBe(true);
            await expect(shouldBlockLocalNetworkRequest('wss://192.168.1.10/socket', [], emptyLookup)).resolves.toBe(true);
            await expect(shouldBlockLocalNetworkRequest('ws://localhost:8080', [], emptyLookup)).resolves.toBe(true);
        });

        it('allows WebSocket connections to the configured server origin', async () => {
            // The server is configured over https; its websocket uses wss on the same host.
            await expect(shouldBlockLocalNetworkRequest(
                'wss://127.0.0.1:8065/api/v4/websocket',
                [new URL('https://127.0.0.1:8065')],
                emptyLookup,
            )).resolves.toBe(false);

            // A server configured over http should allow its ws websocket too.
            await expect(shouldBlockLocalNetworkRequest(
                'ws://127.0.0.1:8065/api/v4/websocket',
                [new URL('http://127.0.0.1:8065')],
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('allows public WebSocket targets', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '8.8.8.8'}]);
            await expect(shouldBlockLocalNetworkRequest('wss://realtime.example.com', [], lookup)).resolves.toBe(false);
        });
    });

    describe('getRequestWebContentsId', () => {
        it('uses webContentsId when present', () => {
            expect(getRequestWebContentsId({
                url: 'http://127.0.0.1:7777/secret',
                webContentsId: 1,
                webContents: {id: 2},
            })).toBe(1);
        });

        it('falls back to webContents.id', () => {
            expect(getRequestWebContentsId({
                url: 'http://127.0.0.1:7777/secret',
                webContents: {id: 2},
            })).toBe(2);
        });
    });

    describe('shouldCancelLocalNetworkRequest', () => {
        const isServerWebContents = (webContentsId: number) => webContentsId === 1;

        it('blocks server view requests using webContentsId', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                    webContentsId: 1,
                },
                [new URL('http://127.0.0.1:8065')],
                isServerWebContents,
                emptyLookup,
            )).resolves.toBe(true);
        });

        it('blocks server view requests using webContents.id', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                    webContents: {id: 1},
                },
                [new URL('http://127.0.0.1:8065')],
                isServerWebContents,
                emptyLookup,
            )).resolves.toBe(true);
        });

        it('allows configured server origins', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:8065/api/v4/system/ping',
                    webContentsId: 1,
                },
                [new URL('http://127.0.0.1:8065')],
                isServerWebContents,
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('allows requests that belong to a known non-server web contents', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                    webContentsId: 2,
                },
                [new URL('http://127.0.0.1:8065')],
                isServerWebContents,
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('blocks unowned requests (e.g. service workers) to local/private targets', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                },
                [new URL('http://127.0.0.1:8065')],
                isServerWebContents,
                emptyLookup,
            )).resolves.toBe(true);
        });

        it('allows unowned requests to the configured server origin', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:8065/api/v4/websocket',
                },
                [new URL('http://127.0.0.1:8065')],
                isServerWebContents,
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('allows unowned requests to public targets', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '8.8.8.8'}]);
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'https://mattermost.com',
                },
                [new URL('http://127.0.0.1:8065')],
                isServerWebContents,
                lookup,
            )).resolves.toBe(false);
        });
    });
});
