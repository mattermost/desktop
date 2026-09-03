// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    isLocalOrPrivateIPAddress,
    shouldCancelLocalNetworkRequest,
    shouldBlockLocalNetworkRequest,
} from './localNetworkAccess';

jest.mock('app/views/webContentsManager', () => ({
    getViewByWebContentsId: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    getAllServers: jest.fn(),
}));

describe('main/security/localNetworkAccess', () => {
    const emptyLookup = jest.fn().mockResolvedValue([]);
    const WebContentsManager = jest.requireMock('app/views/webContentsManager');
    const ServerManager = jest.requireMock('common/servers/serverManager');

    beforeEach(() => {
        emptyLookup.mockClear();
        WebContentsManager.getViewByWebContentsId.mockClear();
        WebContentsManager.getViewByWebContentsId.mockImplementation((webContentsId: number) => (webContentsId === 1 ? {id: 1} : undefined));
        ServerManager.getAllServers.mockReturnValue([{url: new URL('http://127.0.0.1:8065')}]);
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
            expect(isLocalOrPrivateIPAddress('fec0::1')).toBe(true);
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
            await expect(shouldBlockLocalNetworkRequest(
                'wss://127.0.0.1:8065/api/v4/websocket',
                [new URL('https://127.0.0.1:8065')],
                emptyLookup,
            )).resolves.toBe(false);

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

    describe('shouldCancelLocalNetworkRequest', () => {
        it('blocks server view requests using webContentsId', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                    webContentsId: 1,
                },
                emptyLookup,
            )).resolves.toBe(true);
        });

        it('allows configured server origins', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:8065/api/v4/system/ping',
                    webContentsId: 1,
                },
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('blocks local/private requests from web contents that are not registered views', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                    webContentsId: 2,
                },
                emptyLookup,
            )).resolves.toBe(true);
        });

        it('blocks local/private requests from unregistered web contents across ranges and protocols', async () => {
            const urls = [
                'http://10.0.0.5/admin',
                'http://192.168.1.10/router',
                'http://172.16.0.1/internal',
                'http://169.254.169.254/latest/meta-data',
                'http://localhost:7777/secret',
                'http://[::1]:7777/secret',
                'ws://127.0.0.1:9000',
                'wss://192.168.1.10/socket',
            ];

            for (const url of urls) {
                await expect(shouldCancelLocalNetworkRequest({url, webContentsId: 2}, emptyLookup)).resolves.toBe(true);
            }
        });

        it('blocks unregistered web contents requests to hostnames that resolve to private addresses', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '10.0.0.5'}]);

            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://internal.example.com',
                    webContentsId: 2,
                },
                lookup,
            )).resolves.toBe(true);
        });

        it('allows unregistered web contents requests to the configured server origin', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:8065/plugins/com.mattermost.calls/standalone/widget.html',
                    webContentsId: 2,
                },
                emptyLookup,
            )).resolves.toBe(false);

            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'ws://127.0.0.1:8065/api/v4/websocket',
                    webContentsId: 2,
                },
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('allows unregistered web contents requests to public targets', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '8.8.8.8'}]);

            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'https://mattermost.com',
                    webContentsId: 2,
                },
                lookup,
            )).resolves.toBe(false);
        });

        it('blocks local/private requests to a different port on the configured server host', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:8066/secret',
                    webContentsId: 2,
                },
                emptyLookup,
            )).resolves.toBe(true);
        });

        it('does not consult the web contents registry to make a decision', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                    webContentsId: 2,
                },
                emptyLookup,
            )).resolves.toBe(true);

            expect(WebContentsManager.getViewByWebContentsId).not.toHaveBeenCalled();
        });

        it('blocks unowned requests to local/private targets', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:7777/secret',
                },
                emptyLookup,
            )).resolves.toBe(true);
        });

        it('allows unowned requests to the configured server origin', async () => {
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'http://127.0.0.1:8065/api/v4/websocket',
                },
                emptyLookup,
            )).resolves.toBe(false);
        });

        it('allows unowned requests to public targets', async () => {
            const lookup = jest.fn().mockResolvedValue([{address: '8.8.8.8'}]);
            await expect(shouldCancelLocalNetworkRequest(
                {
                    url: 'https://mattermost.com',
                },
                lookup,
            )).resolves.toBe(false);
        });
    });
});
