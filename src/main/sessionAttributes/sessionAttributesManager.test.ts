// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent} from 'electron';
import {ipcMain} from 'electron';

import WebContentsManager from 'app/views/webContentsManager';
import {
    SERVER_REMOVED,
    SESSION_ATTRIBUTES_MANIFEST_INVALIDATED,
    SESSION_ATTRIBUTES_RESEND_REQUESTED,
} from 'common/communication';
import {COOKIE_NAME_AUTH_TOKEN} from 'common/constants';
import ServerManager from 'common/servers/serverManager';
import {updateServerInfos} from 'main/app/utils';

import type {SAField} from 'types/sessionAttributes';

import SessionAttributeCollector from './collector';
import {SessionAttributesManager} from './sessionAttributesManager';

jest.mock('electron', () => ({
    ipcMain: {
        on: jest.fn(),
    },
}));

jest.mock('app/views/webContentsManager', () => ({
    __esModule: true,
    default: {
        getViewByWebContentsId: jest.fn(),
    },
}));

jest.mock('common/servers/serverManager', () => ({
    __esModule: true,
    default: {
        on: jest.fn(),
        getServer: jest.fn(),
        lookupServerByURL: jest.fn(),
        getRemoteInfo: jest.fn(),
    },
}));

jest.mock('main/app/utils', () => ({
    updateServerInfos: jest.fn(),
}));

jest.mock('./collector', () => ({
    __esModule: true,
    default: {
        getClientIPAddress: jest.fn(() => '10.0.0.1'),
        getOSPlatform: jest.fn(() => 'macos'),
    },
}));

const manifest: SAField[] = [
    {name: 'client_ip_address', type: 'string', ttl_seconds: 30, grace_period_seconds: 60, platforms: ['desktop']},
    {name: 'os_platform', type: 'string', ttl_seconds: 0, grace_period_seconds: 0, platforms: ['desktop']},
];

const server = {
    id: 'server-1',
    url: new URL('https://chat.example.com'),
};

const ServerManagerMock = jest.mocked(ServerManager);
const WebContentsManagerMock = jest.mocked(WebContentsManager);
const updateServerInfosMock = jest.mocked(updateServerInfos);
const ipcMainMock = jest.mocked(ipcMain);
const SessionAttributeCollectorMock = jest.mocked(SessionAttributeCollector);

describe('main/sessionAttributes/sessionAttributesManager', () => {
    let manager: SessionAttributesManager;
    let serverRemovedHandler: (srv: typeof server) => void;
    let manifestInvalidatedHandler: (event: IpcMainEvent) => void;
    let resendRequestedHandler: (event: IpcMainEvent) => void;

    beforeEach(() => {
        jest.clearAllMocks();
        ServerManagerMock.on.mockImplementation((event, handler) => {
            if (event === SERVER_REMOVED) {
                serverRemovedHandler = handler;
            }
            return ServerManagerMock;
        });
        ipcMainMock.on.mockImplementation((channel, handler) => {
            if (channel === SESSION_ATTRIBUTES_MANIFEST_INVALIDATED) {
                manifestInvalidatedHandler = handler;
            }
            if (channel === SESSION_ATTRIBUTES_RESEND_REQUESTED) {
                resendRequestedHandler = handler;
            }
            return ipcMainMock;
        });
        ServerManagerMock.getServer.mockReturnValue(server as never);
        ServerManagerMock.lookupServerByURL.mockReturnValue(server as never);
        ServerManagerMock.getRemoteInfo.mockReturnValue({sessionAttributesManifest: manifest});
        updateServerInfosMock.mockResolvedValue(undefined);

        manager = new SessionAttributesManager();
    });

    it('returns undefined without MMAUTHTOKEN cookie', () => {
        const result = manager.getHeaderForRequest(server.url.toString(), {});
        expect(result).toBeUndefined();
    });

    it('builds a base64 header for expired attributes', () => {
        const header = manager.getHeaderForRequest(server.url.toString(), {
            Cookie: `${COOKIE_NAME_AUTH_TOKEN}=abc123`,
        });

        expect(header).toBeDefined();
        const decoded = JSON.parse(Buffer.from(header!, 'base64').toString('utf8'));
        expect(decoded).toEqual({
            client_ip_address: '10.0.0.1',
            os_platform: 'macos',
        });
        expect(SessionAttributeCollectorMock.getClientIPAddress).toHaveBeenCalled();
        expect(SessionAttributeCollectorMock.getOSPlatform).toHaveBeenCalled();
    });

    it('does not resend attributes before TTL expires', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'client_ip_address', type: 'string', ttl_seconds: 300, grace_period_seconds: 60, platforms: ['desktop']},
            ],
        });
        const sentMap = new Map([['client_ip_address', Date.now()]]);
        (manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.set(server.id, sentMap);

        const header = manager.getHeaderForRequest(server.url.toString(), {
            Cookie: `${COOKIE_NAME_AUTH_TOKEN}=abc123`,
        });

        expect(header).toBeUndefined();
    });

    it('resends ttl_seconds 0 attributes on every request', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'os_platform', type: 'string', ttl_seconds: 0, grace_period_seconds: 0, platforms: ['desktop']},
            ],
        });
        (manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.set(server.id, new Map([['os_platform', Date.now()]]));

        const header = manager.getHeaderForRequest(server.url.toString(), {
            Cookie: `${COOKIE_NAME_AUTH_TOKEN}=abc123`,
        });

        expect(header).toBeDefined();
        const decoded = JSON.parse(Buffer.from(header!, 'base64').toString('utf8'));
        expect(decoded.os_platform).toBe('macos');
        expect(SessionAttributeCollectorMock.getOSPlatform).toHaveBeenCalled();
    });

    it('omits blank attribute values from the header', () => {
        SessionAttributeCollectorMock.getClientIPAddress.mockReturnValue('');
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'client_ip_address', type: 'string', ttl_seconds: 30, grace_period_seconds: 60, platforms: ['desktop']},
                {name: 'os_platform', type: 'string', ttl_seconds: 0, grace_period_seconds: 0, platforms: ['desktop']},
            ],
        });

        const header = manager.getHeaderForRequest(server.url.toString(), {
            Cookie: `${COOKIE_NAME_AUTH_TOKEN}=abc123`,
        });

        expect(header).toBeDefined();
        const decoded = JSON.parse(Buffer.from(header!, 'base64').toString('utf8'));
        expect(decoded).toEqual({os_platform: 'macos'});
    });

    it('clears lastSentAt on SERVER_REMOVED', () => {
        (manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.set(server.id, new Map([['client_ip_address', Date.now()]]));
        serverRemovedHandler(server);
        expect((manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.has(server.id)).toBe(false);
    });

    it('refreshes remote info on SESSION_ATTRIBUTES_MANIFEST_INVALIDATED', async () => {
        WebContentsManagerMock.getViewByWebContentsId.mockReturnValue({serverId: server.id} as never);
        manifestInvalidatedHandler({sender: {id: 42}} as IpcMainEvent);
        await Promise.resolve();
        expect(updateServerInfos).toHaveBeenCalledWith([server]);
    });

    it('clears lastSentAt on SESSION_ATTRIBUTES_RESEND_REQUESTED when manifest exists', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'client_ip_address', type: 'string', ttl_seconds: 300, grace_period_seconds: 60, platforms: ['desktop']},
            ],
        });
        (manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.set(server.id, new Map([['client_ip_address', Date.now()]]));

        WebContentsManagerMock.getViewByWebContentsId.mockReturnValue({serverId: server.id} as never);
        resendRequestedHandler({sender: {id: 42}} as IpcMainEvent);

        expect((manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.has(server.id)).toBe(false);
    });

    it('does not clear lastSentAt on SESSION_ATTRIBUTES_RESEND_REQUESTED when manifest is missing', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({});
        (manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.set(server.id, new Map([['client_ip_address', Date.now()]]));

        WebContentsManagerMock.getViewByWebContentsId.mockReturnValue({serverId: server.id} as never);
        resendRequestedHandler({sender: {id: 42}} as IpcMainEvent);

        expect(updateServerInfos).not.toHaveBeenCalled();
        expect((manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.has(server.id)).toBe(true);
    });
});
