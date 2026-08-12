// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent} from 'electron';
import {ipcMain} from 'electron';

import WebContentsManager from 'app/views/webContentsManager';
import {
    SERVER_REMOVED,
    SESSION_ATTRIBUTES_FIELD_UPDATED,
    SESSION_ATTRIBUTES_MANIFEST_INVALIDATED,
    SESSION_ATTRIBUTES_RESEND_REQUESTED,
} from 'common/communication';
import Config from 'common/config';
import {COOKIE_NAME_AUTH_TOKEN} from 'common/constants';
import ServerManager from 'common/servers/serverManager';
import {updateServerInfos} from 'main/app/utils';

import type {SAField} from 'types/sessionAttributes';

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

jest.mock('common/config', () => ({
    __esModule: true,
    default: {
        enableSessionAttributes: true,
    },
}));

jest.mock('common/servers/serverManager', () => ({
    __esModule: true,
    default: {
        on: jest.fn(),
        getServer: jest.fn(),
        lookupServerByURL: jest.fn(),
        getRemoteInfo: jest.fn(),
        updateRemoteInfo: jest.fn(),
    },
}));

jest.mock('main/app/utils', () => ({
    updateServerInfos: jest.fn(),
}));

const mockCollector = {
    getClientIPAddress: jest.fn(() => '10.0.0.1'),
    getOSPlatform: jest.fn(() => 'macos'),
};

jest.mock('./collector', () => ({
    __esModule: true,
    default: jest.fn(() => mockCollector),
}));

const manifest: SAField[] = [
    {name: 'client_ip_address', type: 'string', ttl_seconds: 30, grace_period_seconds: 60, platforms: ['desktop']},
    {name: 'os_platform', type: 'string', ttl_seconds: 0, grace_period_seconds: 0, platforms: ['desktop']},
];

const server = {
    id: 'server-1',
    url: new URL('https://chat.example.com'),
};

const ConfigMock = jest.mocked(Config);
const ServerManagerMock = jest.mocked(ServerManager);
const WebContentsManagerMock = jest.mocked(WebContentsManager);
const updateServerInfosMock = jest.mocked(updateServerInfos);
const ipcMainMock = jest.mocked(ipcMain);

describe('main/sessionAttributes/sessionAttributesManager', () => {
    let manager: SessionAttributesManager;
    let serverRemovedHandler: (srv: typeof server) => void;
    let manifestInvalidatedHandler: (event: IpcMainEvent) => void;
    let resendRequestedHandler: (event: IpcMainEvent) => void;
    let fieldUpdatedHandler: (event: IpcMainEvent, field: unknown) => void;

    beforeEach(() => {
        jest.clearAllMocks();
        ConfigMock.enableSessionAttributes = true;
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
            if (channel === SESSION_ATTRIBUTES_FIELD_UPDATED) {
                fieldUpdatedHandler = handler;
            }
            return ipcMainMock;
        });
        ServerManagerMock.getServer.mockReturnValue(server as never);
        ServerManagerMock.lookupServerByURL.mockReturnValue(server as never);
        ServerManagerMock.getRemoteInfo.mockReturnValue({sessionAttributesManifest: manifest});
        updateServerInfosMock.mockResolvedValue(undefined);

        manager = new SessionAttributesManager();
    });

    it('returns undefined when session attributes are disabled', () => {
        ConfigMock.enableSessionAttributes = false;

        const header = manager.getHeaderForRequest(server.url.toString(), {
            Cookie: `${COOKIE_NAME_AUTH_TOKEN}=abc123`,
        });

        expect(header).toBeUndefined();
        expect(mockCollector.getClientIPAddress).not.toHaveBeenCalled();
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
        expect(mockCollector.getClientIPAddress).toHaveBeenCalled();
        expect(mockCollector.getOSPlatform).toHaveBeenCalled();
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
        expect(mockCollector.getOSPlatform).toHaveBeenCalled();
    });

    it('omits blank attribute values from the header', () => {
        mockCollector.getClientIPAddress.mockReturnValue('');
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

    it('appends a new field to the manifest on SESSION_ATTRIBUTES_FIELD_UPDATED', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'os_platform', type: 'text', ttl_seconds: 0, grace_period_seconds: 0, platforms: ['desktop']},
            ],
        });
        WebContentsManagerMock.getViewByWebContentsId.mockReturnValue({serverId: server.id} as never);

        fieldUpdatedHandler({sender: {id: 42}} as IpcMainEvent, {
            name: 'hardware_id',
            type: 'text',
            attrs: {enabled: true, ttl_seconds: 300, grace_period_seconds: 300, platforms: ['desktop']},
        });

        expect(ServerManagerMock.updateRemoteInfo).toHaveBeenCalledWith(server.id, {
            sessionAttributesManifest: [
                {name: 'os_platform', type: 'text', ttl_seconds: 0, grace_period_seconds: 0, platforms: ['desktop']},
                {name: 'hardware_id', type: 'text', ttl_seconds: 300, grace_period_seconds: 300, platforms: ['desktop']},
            ],
        });
    });

    it('replaces an existing field in the manifest on SESSION_ATTRIBUTES_FIELD_UPDATED', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'hardware_id', type: 'text', ttl_seconds: 60, grace_period_seconds: 60, platforms: ['desktop']},
            ],
        });
        WebContentsManagerMock.getViewByWebContentsId.mockReturnValue({serverId: server.id} as never);

        fieldUpdatedHandler({sender: {id: 42}} as IpcMainEvent, {
            name: 'hardware_id',
            type: 'text',
            attrs: {enabled: true, ttl_seconds: 300, grace_period_seconds: 300, platforms: ['desktop']},
        });

        expect(ServerManagerMock.updateRemoteInfo).toHaveBeenCalledWith(server.id, {
            sessionAttributesManifest: [
                {name: 'hardware_id', type: 'text', ttl_seconds: 300, grace_period_seconds: 300, platforms: ['desktop']},
            ],
        });
    });

    it('removes a field from the manifest when it is disabled', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'hardware_id', type: 'text', ttl_seconds: 300, grace_period_seconds: 300, platforms: ['desktop']},
            ],
        });
        WebContentsManagerMock.getViewByWebContentsId.mockReturnValue({serverId: server.id} as never);

        fieldUpdatedHandler({sender: {id: 42}} as IpcMainEvent, {
            name: 'hardware_id',
            type: 'text',
            attrs: {enabled: false, ttl_seconds: 300, grace_period_seconds: 300, platforms: ['desktop']},
        });

        expect(ServerManagerMock.updateRemoteInfo).toHaveBeenCalledWith(server.id, {
            sessionAttributesManifest: [],
        });
    });

    it('does not track a field that no longer targets the desktop', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'hardware_id', type: 'text', ttl_seconds: 300, grace_period_seconds: 300, platforms: ['desktop']},
            ],
        });
        WebContentsManagerMock.getViewByWebContentsId.mockReturnValue({serverId: server.id} as never);

        fieldUpdatedHandler({sender: {id: 42}} as IpcMainEvent, {
            name: 'hardware_id',
            type: 'text',
            attrs: {enabled: true, ttl_seconds: 300, grace_period_seconds: 300, platforms: ['mobile']},
        });

        expect(ServerManagerMock.updateRemoteInfo).toHaveBeenCalledWith(server.id, {
            sessionAttributesManifest: [],
        });
    });

    it('clears the lastSentAt entry for the updated field so it is resent', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'hardware_id', type: 'text', ttl_seconds: 300, grace_period_seconds: 300, platforms: ['desktop']},
            ],
        });
        (manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.set(server.id, new Map([['hardware_id', Date.now()]]));
        WebContentsManagerMock.getViewByWebContentsId.mockReturnValue({serverId: server.id} as never);

        fieldUpdatedHandler({sender: {id: 42}} as IpcMainEvent, {
            name: 'hardware_id',
            type: 'text',
            attrs: {enabled: true, ttl_seconds: 600, grace_period_seconds: 300, platforms: ['desktop']},
        });

        expect((manager as unknown as {lastSentAt: Map<string, Map<string, number>>}).lastSentAt.get(server.id)?.has('hardware_id')).toBe(false);
    });

    it('ignores an invalid field payload on SESSION_ATTRIBUTES_FIELD_UPDATED', () => {
        ServerManagerMock.getRemoteInfo.mockReturnValue({
            sessionAttributesManifest: [
                {name: 'hardware_id', type: 'text', ttl_seconds: 300, grace_period_seconds: 300, platforms: ['desktop']},
            ],
        });
        WebContentsManagerMock.getViewByWebContentsId.mockReturnValue({serverId: server.id} as never);

        fieldUpdatedHandler({sender: {id: 42}} as IpcMainEvent, {name: 'hardware_id'});

        expect(ServerManagerMock.updateRemoteInfo).not.toHaveBeenCalled();
    });
});
