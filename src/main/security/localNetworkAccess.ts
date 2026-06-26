// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import dns from 'dns/promises';
import {isIP} from 'net';

import {parseURL} from 'common/utils/url';

type LookupAddress = {
    address: string;
}

type LookupFunction = (hostname: string) => Promise<LookupAddress[]>;

export type LocalNetworkRequestDetails = {
    url: string;
    webContentsId?: number;
    webContents?: {
        id: number;
    };
}

type IsServerWebContents = (webContentsId: number) => boolean;

const defaultLookup: LookupFunction = (hostname: string) => dns.lookup(hostname, {all: true, verbatim: true});

export function getRequestWebContentsId(details: LocalNetworkRequestDetails): number | undefined {
    return details.webContentsId || details.webContents?.id;
}

export async function shouldCancelLocalNetworkRequest(
    details: LocalNetworkRequestDetails,
    serverURLs: URL[],
    isServerWebContents: IsServerWebContents,
    lookup: LookupFunction = defaultLookup,
): Promise<boolean> {
    const webContentsId = getRequestWebContentsId(details);

    if (webContentsId && !isServerWebContents(webContentsId)) {
        return false;
    }

    // Unowned requests reach here too: Electron exposes no webContentsId for service/shared
    // workers, so without this they would bypass the filter. Configured origins stay exempt.
    return shouldBlockLocalNetworkRequest(details.url, serverURLs, lookup);
}

// ws/wss included so server content cannot probe the local network over WebSockets.
const FILTERED_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);

// Normalize ws/wss to http/https so a server's WebSocket counts as the same configured origin.
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
    if (isIP(address) === 4) {
        return isLocalOrPrivateIPv4(address);
    }

    if (isIP(address) === 6) {
        return isLocalOrPrivateIPv6(address);
    }

    return false;
}

function isLocalOrPrivateIPv4(address: string): boolean {
    const parts = address.split('.').map((part) => Number(part));
    const [first, second] = parts;

    return (
        first === 0 ||
        first === 10 ||
        first === 127 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168)
    );
}

function isLocalOrPrivateIPv6(address: string): boolean {
    const bytes = parseIPv6Bytes(address);
    if (!bytes) {
        return false;
    }

    if (isIPv4MappedIPv6(bytes)) {
        return isLocalOrPrivateIPv4(bytes.slice(12).join('.'));
    }

    const isLoopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
    const isUniqueLocal = (bytes[0] & 0xfe) === 0xfc;
    const isLinkLocal = bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80;

    return isLoopback || isUniqueLocal || isLinkLocal;
}

function isIPv4MappedIPv6(bytes: number[]): boolean {
    return bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
}

function parseIPv6Bytes(address: string): number[] | undefined {
    const expandedAddress = expandIPv4Tail(address);
    const [left, right] = expandedAddress.split('::');
    const leftParts = left ? left.split(':') : [];
    const rightParts = right ? right.split(':') : [];
    const missingParts = 8 - leftParts.length - rightParts.length;

    if (missingParts < 0 || expandedAddress.split('::').length > 2) {
        return undefined;
    }

    const parts = [
        ...leftParts,
        ...Array(Math.max(missingParts, 0)).fill('0'),
        ...rightParts,
    ];

    if (parts.length !== 8) {
        return undefined;
    }

    const bytes: number[] = [];
    for (const part of parts) {
        const value = Number.parseInt(part || '0', 16);
        if (!Number.isFinite(value) || value < 0 || value > 0xffff) {
            return undefined;
        }
        bytes.push((value >> 8) & 0xff, value & 0xff);
    }

    return bytes;
}

function expandIPv4Tail(address: string): string {
    const lastColon = address.lastIndexOf(':');
    if (lastColon === -1) {
        return address;
    }

    const tail = address.slice(lastColon + 1);
    if (isIP(tail) !== 4) {
        return address;
    }

    const parts = tail.split('.').map((part) => Number(part));
    const first = ((parts[0] << 8) | parts[1]).toString(16);
    const second = ((parts[2] << 8) | parts[3]).toString(16);
    return `${address.slice(0, lastColon)}:${first}:${second}`;
}
