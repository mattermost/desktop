// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import dns from 'dns/promises';
import {BlockList, isIP} from 'net';

import {parseURL} from 'common/utils/url';

type LookupAddress = {
    address: string;
}

type LookupFunction = (hostname: string) => Promise<LookupAddress[]>;

export type LocalNetworkRequestDetails = {
    url: string;
    webContentsId?: number;
}

type IsServerWebContents = (webContentsId: number) => boolean;

const defaultLookup: LookupFunction = (hostname: string) => dns.lookup(hostname, {all: true, verbatim: true});

const LOCAL_NETWORK_BLOCKLIST = new BlockList();

LOCAL_NETWORK_BLOCKLIST.addSubnet('0.0.0.0', 8, 'ipv4');
LOCAL_NETWORK_BLOCKLIST.addSubnet('10.0.0.0', 8, 'ipv4');
LOCAL_NETWORK_BLOCKLIST.addSubnet('127.0.0.0', 8, 'ipv4');
LOCAL_NETWORK_BLOCKLIST.addSubnet('169.254.0.0', 16, 'ipv4');
LOCAL_NETWORK_BLOCKLIST.addSubnet('172.16.0.0', 12, 'ipv4');
LOCAL_NETWORK_BLOCKLIST.addSubnet('192.168.0.0', 16, 'ipv4');
LOCAL_NETWORK_BLOCKLIST.addSubnet('::1', 128, 'ipv6');
LOCAL_NETWORK_BLOCKLIST.addSubnet('fc00::', 7, 'ipv6');
LOCAL_NETWORK_BLOCKLIST.addSubnet('fec0::', 10, 'ipv6');
LOCAL_NETWORK_BLOCKLIST.addSubnet('fe80::', 10, 'ipv6');

export async function shouldCancelLocalNetworkRequest(
    details: LocalNetworkRequestDetails,
    serverURLs: URL[],
    isServerWebContents: IsServerWebContents,
    lookup: LookupFunction = defaultLookup,
): Promise<boolean> {
    if (details.webContentsId && !isServerWebContents(details.webContentsId)) {
        return false;
    }

    return shouldBlockLocalNetworkRequest(details.url, serverURLs, lookup);
}

const FILTERED_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);

const WEBSOCKET_PROTOCOL_EQUIVALENTS: {[protocol: string]: string} = {
    'ws:': 'http:',
    'wss:': 'https:',
};

function getComparableOrigin(url: URL): string {
    const protocol = WEBSOCKET_PROTOCOL_EQUIVALENTS[url.protocol] ?? url.protocol;
    return `${protocol}//${url.host}`;
}

export function isAllowedServerOrigin(url: URL, serverURLs: URL[]): boolean {
    const targetOrigin = getComparableOrigin(url);
    return serverURLs.some((serverURL) => getComparableOrigin(serverURL) === targetOrigin);
}

export async function shouldBlockLocalNetworkRequest(
    rawURL: string,
    serverURLs: URL[],
    lookup: LookupFunction = defaultLookup,
): Promise<boolean> {
    const url = parseURL(rawURL);
    if (!url) {
        return false;
    }

    if (!FILTERED_PROTOCOLS.has(url.protocol)) {
        return false;
    }

    if (isAllowedServerOrigin(url, serverURLs)) {
        return false;
    }

    return isLocalOrPrivateHostname(url.hostname, lookup);
}

export async function isLocalOrPrivateHostname(hostname: string, lookup: LookupFunction = defaultLookup): Promise<boolean> {
    const normalizedHostname = normalizeHostname(hostname);

    if (isLocalhostHostname(normalizedHostname)) {
        return true;
    }

    if (isLocalOrPrivateIPAddress(normalizedHostname)) {
        return true;
    }

    try {
        const addresses = await lookup(normalizedHostname);
        return addresses.some(({address}) => isLocalOrPrivateIPAddress(normalizeHostname(address)));
    } catch {
        return false;
    }
}

function normalizeHostname(hostname: string): string {
    return hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').split('%')[0];
}

function isLocalhostHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname.endsWith('.localhost');
}

export function isLocalOrPrivateIPAddress(address: string): boolean {
    const family = isIP(address);
    if (family === 4) {
        return LOCAL_NETWORK_BLOCKLIST.check(address, 'ipv4');
    }

    if (family === 6) {
        return LOCAL_NETWORK_BLOCKLIST.check(address, 'ipv6');
    }

    return false;
}
