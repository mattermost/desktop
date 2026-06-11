// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, OnBeforeSendHeadersListenerDetails} from 'electron';
import {ipcMain} from 'electron';

import WebContentsManager from 'app/views/webContentsManager';
import {
    SERVER_PRE_AUTH_SECRET_CHANGED,
    SERVER_REMOVED,
    SERVER_URL_CHANGED,
    SESSION_ATTRIBUTES_MANIFEST_INVALIDATED,
    SESSION_ATTRIBUTES_RESEND_REQUESTED,
} from 'common/communication';
import Config from 'common/config';
import {COOKIE_NAME_AUTH_TOKEN} from 'common/constants';
import {Logger} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {parseURL} from 'common/utils/url';
import {updateServerInfos} from 'main/app/utils';

import type {SAField} from 'types/sessionAttributes';

import SessionAttributeCollector from './collector';

const log = new Logger('SessionAttributesManager');

export class SessionAttributesManager {
    private lastSentAt = new Map<string, Map<string, number>>();

    constructor() {
        ServerManager.on(SERVER_URL_CHANGED, this.handleServerChanged);
        ServerManager.on(SERVER_PRE_AUTH_SECRET_CHANGED, this.handleServerChanged);
        ServerManager.on(SERVER_REMOVED, this.handleServerRemoved);

        ipcMain.on(SESSION_ATTRIBUTES_MANIFEST_INVALIDATED, this.handleManifestInvalidated);
        ipcMain.on(SESSION_ATTRIBUTES_RESEND_REQUESTED, this.handleResendRequested);
    }

    getHeaderForRequest = (
        requestURL: string,
        requestHeaders: Record<string, string | string[]>,
    ): string | undefined => {
        if (!Config.enableSessionAttributes) {
            return undefined;
        }

        // Without a session, we can't send session attributes.
        if (!this.hasAuthCookie(requestHeaders)) {
            return undefined;
        }

        const parsed = parseURL(requestURL);
        if (!parsed) {
            return undefined;
        }

        const server = ServerManager.lookupServerByURL(requestURL);
        if (!server) {
            return undefined;
        }

        const manifest = ServerManager.getRemoteInfo(server.id)?.sessionAttributesManifest;
        if (!manifest?.length) {
            return undefined;
        }

        const now = Date.now();
        let fieldsToSend: SAField[] = [];
        let sentMap = this.lastSentAt.get(server.id);
        if (sentMap) {
            // Only send fields that have expired
            fieldsToSend = manifest.filter((field) => {
                const lastSent = sentMap!.get(field.name);
                if (!lastSent || field.ttl_seconds === 0) {
                    return true;
                }
                return now - lastSent >= field.ttl_seconds * 1000;
            });
        } else {
            // If we don't have a sent map, send all fields
            fieldsToSend = manifest;
            sentMap = new Map<string, number>();
        }

        const payload: Record<string, unknown> = {};
        for (const field of fieldsToSend) {
            const value = this.collectAttribute(field.name, server.id);
            if (value) {
                payload[field.name] = value;
            }
            sentMap.set(field.name, now);
        }
        this.lastSentAt.set(server.id, sentMap);

        if (!Object.keys(payload).length) {
            return undefined;
        }

        return Buffer.from(JSON.stringify(payload)).toString('base64');
    };

    injectHeader = (
        details: OnBeforeSendHeadersListenerDetails,
    ): Record<string, string | string[]> => {
        const value = this.getHeaderForRequest(details.url, details.requestHeaders);
        if (!value) {
            return {};
        }
        return {
            'X-MM-Session-Attributes': value,
        };
    };

    private collectAttribute = (name: string, serverId: string) => {
        try {
            switch (name) {
            case 'client_ip_address':
                return SessionAttributeCollector.getClientIPAddress();
            case 'network_interface_type':
                return SessionAttributeCollector.getNetworkInterfaceType();
            case 'vpn_active':
                return SessionAttributeCollector.getVPNActive();
            case 'ssid':
                return SessionAttributeCollector.getSSID();
            case 'hardware_id':
                return SessionAttributeCollector.getHardwareId();
            case 'mdm_enrolled':
                return SessionAttributeCollector.getMDMEnrolled();
            case 'os_platform':
                return SessionAttributeCollector.getOSPlatform();
            case 'os_version':
                return SessionAttributeCollector.getOSVersion();
            case 'client_version':
                return SessionAttributeCollector.getClientVersion();
            case 'server_fqdn':
                return SessionAttributeCollector.getServerFQDN(serverId);
            case 'client_fqdn':
                return SessionAttributeCollector.getClientFQDN();
            default:
                return '';
            }
        } catch (error) {
            log.warn('Collector failed', {name, error});
            return '';
        }
    };

    private hasAuthCookie = (headers: Record<string, string | string[]>): boolean => {
        const cookie = headers.Cookie ?? headers.cookie;
        if (!cookie) {
            return false;
        }
        const cookieStr = Array.isArray(cookie) ? cookie.join(';') : cookie;
        return cookieStr.includes(`${COOKIE_NAME_AUTH_TOKEN}=`);
    };

    private handleServerChanged = (serverId: string) => {
        this.lastSentAt.delete(serverId);
    };

    private handleServerRemoved = (server: MattermostServer) => {
        this.lastSentAt.delete(server.id);
    };

    private handleManifestInvalidated = async (event: IpcMainEvent) => {
        log.debug('handleManifestInvalidated');

        const serverId = WebContentsManager.getViewByWebContentsId(event.sender.id)?.serverId;
        if (!serverId) {
            return;
        }

        const server = ServerManager.getServer(serverId);
        if (!server) {
            return;
        }

        try {
            await updateServerInfos([server]);
            this.lastSentAt.delete(serverId);
        } catch (error) {
            log.warn('Remote info refresh failed', {serverId, error});
        }
    };

    private handleResendRequested = (event: IpcMainEvent) => {
        log.debug('handleResendRequested');

        const serverId = WebContentsManager.getViewByWebContentsId(event.sender.id)?.serverId;
        if (!serverId) {
            return;
        }
        if (!ServerManager.getRemoteInfo(serverId)?.sessionAttributesManifest?.length) {
            return;
        }
        this.lastSentAt.delete(serverId);
    };
}

const sessionAttributesManager = new SessionAttributesManager();
export default sessionAttributesManager;
