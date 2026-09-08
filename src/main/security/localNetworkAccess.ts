// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import dns from 'dns/promises';
import {BlockList, isIP} from 'net';

import type {WebContents} from 'electron';

import {FILTERED_PROTOCOLS, WEBSOCKET_PROTOCOL_EQUIVALENTS} from 'common/constants';
import ServerManager from 'common/servers/serverManager';
import {parseURL} from 'common/utils/url';

type LookupFunction = (hostname: string) => Promise<Array<{address: string}>>;
type LocalNetworkRequestDetails = {
    url: string;
    webContentsId?: number;
};

const defaultLookup: LookupFunction = (hostname: string) => dns.lookup(hostname, {all: true, verbatim: true});

export class LocalNetworkAccessManager {
    private monitoredWebContents: Set<number>;
    private blockList: BlockList;

    constructor() {
        this.monitoredWebContents = new Set();
        this.blockList = new BlockList();
        this.blockList.addSubnet('0.0.0.0', 8, 'ipv4');
        this.blockList.addSubnet('10.0.0.0', 8, 'ipv4');
        this.blockList.addSubnet('127.0.0.0', 8, 'ipv4');
        this.blockList.addSubnet('169.254.0.0', 16, 'ipv4');
        this.blockList.addSubnet('172.16.0.0', 12, 'ipv4');
        this.blockList.addSubnet('192.168.0.0', 16, 'ipv4');
        this.blockList.addSubnet('::1', 128, 'ipv6');
        this.blockList.addSubnet('fc00::', 7, 'ipv6');
        this.blockList.addSubnet('fec0::', 10, 'ipv6');
        this.blockList.addSubnet('fe80::', 10, 'ipv6');
    }

    registerWebContents = (webContents: WebContents) => {
        if (!webContents || webContents.isDestroyed?.()) {
            return;
        }
        this.monitoredWebContents.add(webContents.id);
    };

    unregisterWebContents = (webContentsId: number) => {
        this.monitoredWebContents.delete(webContentsId);
    };

    isMonitored = (webContentsId?: number): boolean => {
        if (!webContentsId) {
            return false;
        }
        return this.monitoredWebContents.has(webContentsId);
    };

    clear = () => {
        this.monitoredWebContents.clear();
    };

    shouldCancelLocalNetworkRequest = async (
        details: LocalNetworkRequestDetails,
        lookup: LookupFunction = defaultLookup,
    ): Promise<boolean> => {
        if (details.webContentsId && !this.isMonitored(details.webContentsId)) {
            return false;
        }

        const serverURLs = ServerManager.getAllServers().map((server) => server.url);
        return this.shouldBlockLocalNetworkRequest(details.url, serverURLs, lookup);
    };

    shouldBlockLocalNetworkRequest = async (
        rawURL: string,
        serverURLs: URL[],
        lookup: LookupFunction = defaultLookup,
    ): Promise<boolean> => {
        const url = parseURL(rawURL);
        if (!url) {
            return false;
        }

        if (!FILTERED_PROTOCOLS.has(url.protocol)) {
            return false;
        }

        if (this.isAllowedServerOrigin(url, serverURLs)) {
            return false;
        }

        return this.isLocalOrPrivateHostname(url.hostname, lookup);
    };

    isLocalOrPrivateIPAddress = (address: string): boolean => {
        const family = isIP(address);
        if (family === 4) {
            return this.blockList.check(address, 'ipv4');
        }

        if (family === 6) {
            return this.blockList.check(address, 'ipv6');
        }

        return false;
    };

    private isAllowedServerOrigin = (url: URL, serverURLs: URL[]): boolean => {
        const targetOrigin = this.getComparableOrigin(url);
        return serverURLs.some((serverURL) => this.getComparableOrigin(serverURL) === targetOrigin);
    };

    private isLocalOrPrivateHostname = async (
        hostname: string,
        lookup: LookupFunction = defaultLookup,
    ): Promise<boolean> => {
        const normalizedHostname = this.normalizeHostname(hostname);

        if (this.isLocalhostHostname(normalizedHostname)) {
            return true;
        }

        if (this.isLocalOrPrivateIPAddress(normalizedHostname)) {
            return true;
        }

        try {
            const addresses = await lookup(normalizedHostname);
            return addresses.some(({address}) => this.isLocalOrPrivateIPAddress(this.normalizeHostname(address)));
        } catch {
            return false;
        }
    };

    private normalizeHostname = (hostname: string): string => {
        return hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').split('%')[0];
    };

    private isLocalhostHostname = (hostname: string): boolean => {
        return hostname === 'localhost' || hostname.endsWith('.localhost');
    };

    private getComparableOrigin = (url: URL): string => {
        const protocol = WEBSOCKET_PROTOCOL_EQUIVALENTS[url.protocol] ?? url.protocol;
        return `${protocol}//${url.host}`;
    };
}

const localNetworkAccessManager = new LocalNetworkAccessManager();
export default localNetworkAccessManager;
