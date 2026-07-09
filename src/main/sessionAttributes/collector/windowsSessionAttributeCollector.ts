// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';

import koffi from 'koffi';
import {enumerateValues, HKEY} from 'registry-js';

import {Logger} from 'common/log';
import {isRoutableAddress} from 'main/utils';

import {SessionAttributeCollector} from './sessionAttributeCollector';

const log = new Logger('SessionAttributes/windowsSessionAttributeCollector');

const ComputerNameDnsFullyQualified = 3;

const AF_UNSPEC = 0;
const AF_INET = 2;
const AF_INET6 = 23;

const GAA_FLAG_SKIP_ANYCAST = 0x2;
const GAA_FLAG_SKIP_MULTICAST = 0x4;
const GAA_FLAG_SKIP_DNS_SERVER = 0x8;
const GAA_FLAGS = GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER;

const ERROR_BUFFER_OVERFLOW = 111;

const IF_TYPE_PPP = 23;
const IF_TYPE_TUNNEL = 131;
const IF_OPER_STATUS_UP = 1;

const PUBLIC_PROBE_ADDRESS = [8, 8, 8, 8];

const socketAddress = koffi.struct('MM_SOCKET_ADDRESS', {
    lpSockaddr: 'void *',
    sockaddrLength: 'int',
});

const ipAdapterUnicastAddress = koffi.struct('MM_IP_ADAPTER_UNICAST_ADDRESS', {
    length: 'uint32',
    flags: 'uint32',
    next: 'void *',
    address: socketAddress,
});

const ipAdapterAddresses = koffi.struct('MM_IP_ADAPTER_ADDRESSES', {
    length: 'uint32',
    ifIndex: 'uint32',
    next: 'void *',
    adapterName: 'void *',
    firstUnicastAddress: 'void *',
    firstAnycastAddress: 'void *',
    firstMulticastAddress: 'void *',
    firstDnsServerAddress: 'void *',
    dnsSuffix: 'void *',
    description: 'void *',
    friendlyName: 'void *',
    physicalAddress: koffi.array('uint8', 8),
    physicalAddressLength: 'uint32',
    flags: 'uint32',
    mtu: 'uint32',
    ifType: 'uint32',
    operStatus: 'uint32',
});

const sockaddrIn = koffi.struct('MM_SOCKADDR_IN', {
    family: 'uint16',
    port: 'uint16',
    addr: koffi.array('uint8', 4),
});

const sockaddrIn6 = koffi.struct('MM_SOCKADDR_IN6', {
    family: 'uint16',
    port: 'uint16',
    flowinfo: 'uint32',
    addr: koffi.array('uint8', 16),
});

koffi.struct('MM_SOCKADDR_IN_DEST', {
    family: 'int16',
    port: 'uint16',
    addr: koffi.array('uint8', 4),
    zero: koffi.array('uint8', 8),
});

type UnicastAddress = {family: string; address: string};

type AdapterInfo = {
    ifIndex: number;
    ifType: number;
    operStatus: number;
    friendlyName: string;
    addresses: UnicastAddress[];
};

export class WindowsSessionAttributeCollector extends SessionAttributeCollector {
    private readonly bindings?: ReturnType<WindowsSessionAttributeCollector['loadBindings']>;

    constructor() {
        super();
        try {
            this.bindings = this.loadBindings();
        } catch (error) {
            log.warn('Failed to load Windows native libraries', {error});
        }
    }

    getHardwareId() {
        return this.readSMBIOSSerial() ?? '';
    }

    getMDMEnrolled() {
        try {
            const subKeys = enumerateValues(HKEY.HKEY_LOCAL_MACHINE, 'SOFTWARE\\Microsoft\\Enrollments');
            return subKeys.length > 0 ? 'true' : 'false';
        } catch (error) {
            log.warn('Failed to read Enrollments registry', {error});
            return '';
        }
    }

    getOSPlatform() {
        return 'windows';
    }

    getClientIPAddress() {
        const bestIndex = this.getBestInterfaceIndex();
        const adapters = this.enumerateAdapters();
        const preferred = adapters.find((adapter) => adapter.ifIndex === bestIndex);
        const candidates = preferred ? [preferred] : adapters;
        for (const family of ['IPv4', 'IPv6']) {
            for (const adapter of candidates) {
                const match = adapter.addresses.find((addr) => addr.family === family && isRoutableAddress(addr.family, addr.address));
                if (match) {
                    return match.address;
                }
            }
        }
        return '';
    }

    getVPNActive() {
        const bestIndex = this.getBestInterfaceIndex();
        const adapters = this.enumerateAdapters();
        for (const adapter of adapters) {
            if (adapter.operStatus !== IF_OPER_STATUS_UP) {
                continue;
            }
            const looksLikeTunnel = adapter.ifType === IF_TYPE_PPP ||
                adapter.ifType === IF_TYPE_TUNNEL ||
                (/vpn|tap|tun|wireguard|wg/i).test(adapter.friendlyName);
            if (!looksLikeTunnel) {
                continue;
            }
            if (adapter.ifIndex === bestIndex) {
                return 'true';
            }
            if (adapter.addresses.some((addr) => isRoutableAddress(addr.family, addr.address))) {
                return 'true';
            }
        }
        return 'false';
    }

    getClientFQDN() {
        const b = this.bindings;
        if (!b) {
            return '';
        }
        try {
            const sizeBuf = Buffer.alloc(4);
            sizeBuf.writeUInt32LE(0, 0);
            b.getComputerNameExW(ComputerNameDnsFullyQualified, null, sizeBuf);
            const size = sizeBuf.readUInt32LE(0);
            if (!size) {
                return '';
            }
            const nameBuf = Buffer.alloc(size * 2);
            if (!b.getComputerNameExW(ComputerNameDnsFullyQualified, nameBuf, sizeBuf)) {
                return '';
            }
            return nameBuf.toString('utf16le').replace(/\0/g, '').trim();
        } catch (e) {
            log.warn('GetComputerNameExW failed', {error: e});
            return '';
        }
    }

    getNetworkInterfaceType() {
        const ifaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(ifaces)) {
            if (!addrs?.some((a) => !a.internal && (a.family === 'IPv4' || a.family === 'IPv6'))) {
                continue;
            }
            return this.mapInterfaceName(name);
        }
        return '';
    }

    private loadBindings() {
        const kernel32 = koffi.load('kernel32.dll');
        const iphlpapi = koffi.load('iphlpapi.dll');

        return {
            getSystemFirmwareTable: kernel32.func('uint32 GetSystemFirmwareTable(uint32, uint32, void *pFirmwareTableBuffer, uint32 BufferSize)'),
            getComputerNameExW: kernel32.func('uint8 GetComputerNameExW(uint32, _Out_ uint16 *lpBuffer, uint32 *nSize)'),
            getBestInterfaceEx: iphlpapi.func('uint32 GetBestInterfaceEx(MM_SOCKADDR_IN_DEST *pDestAddr, _Out_ uint32 *pdwBestIfIndex)'),
            getAdaptersAddresses: iphlpapi.func('uint32 GetAdaptersAddresses(uint32 Family, uint32 Flags, void *Reserved, void *AdapterAddresses, _Inout_ uint32 *SizePointer)'),
        };
    }

    private getBestInterfaceIndex(): number {
        const b = this.bindings;
        if (!b) {
            return 0;
        }
        try {
            const dest = {
                family: AF_INET,
                port: 0,
                addr: PUBLIC_PROBE_ADDRESS,
                zero: [0, 0, 0, 0, 0, 0, 0, 0],
            };
            const indexOut = [0];
            if (b.getBestInterfaceEx(dest, indexOut) !== 0) {
                return 0;
            }
            return indexOut[0] >>> 0;
        } catch (e) {
            log.warn('GetBestInterfaceEx failed', {error: e});
            return 0;
        }
    }

    private enumerateAdapters(): AdapterInfo[] {
        const b = this.bindings;
        if (!b) {
            return [];
        }
        try {
            const sizeOut = [0];
            if (b.getAdaptersAddresses(AF_UNSPEC, GAA_FLAGS, null, null, sizeOut) !== ERROR_BUFFER_OVERFLOW || !sizeOut[0]) {
                return [];
            }
            const buffer = Buffer.alloc(sizeOut[0]);
            sizeOut[0] = buffer.length;
            if (b.getAdaptersAddresses(AF_UNSPEC, GAA_FLAGS, null, buffer, sizeOut) !== 0) {
                return [];
            }
            const adapters: AdapterInfo[] = [];
            let cursor: unknown = buffer;
            while (cursor) {
                const node = koffi.decode(cursor, ipAdapterAddresses);
                adapters.push({
                    ifIndex: node.ifIndex >>> 0,
                    ifType: node.ifType >>> 0,
                    operStatus: node.operStatus >>> 0,
                    friendlyName: node.friendlyName ? koffi.decode.string16(node.friendlyName) : '',
                    addresses: this.readUnicastAddresses(node.firstUnicastAddress),
                });
                cursor = node.next;
            }
            return adapters;
        } catch (e) {
            log.warn('GetAdaptersAddresses failed', {error: e});
            return [];
        }
    }

    private readUnicastAddresses(first: unknown): UnicastAddress[] {
        const addresses: UnicastAddress[] = [];
        let cursor = first;
        while (cursor) {
            const entry = koffi.decode(cursor, ipAdapterUnicastAddress);
            const sockaddr = entry.address.lpSockaddr;
            if (sockaddr) {
                const family = koffi.decode(sockaddr, 'uint16');
                if (family === AF_INET) {
                    const sa = koffi.decode(sockaddr, sockaddrIn);
                    addresses.push({family: 'IPv4', address: sa.addr.join('.')});
                } else if (family === AF_INET6) {
                    const sa = koffi.decode(sockaddr, sockaddrIn6);
                    addresses.push({family: 'IPv6', address: this.formatIPv6(sa.addr)});
                }
            }
            cursor = entry.next;
        }
        return addresses;
    }

    private formatIPv6(bytes: number[]): string {
        const groups: string[] = [];
        for (let i = 0; i < 16; i += 2) {
            groups.push((((bytes[i] << 8) | bytes[i + 1]) >>> 0).toString(16));
        }
        let bestStart = -1;
        let bestLen = 0;
        let runStart = -1;
        let runLen = 0;
        for (let i = 0; i < groups.length; i++) {
            if (groups[i] === '0') {
                runStart = runStart < 0 ? i : runStart;
                runLen++;
                if (runLen > bestLen) {
                    bestLen = runLen;
                    bestStart = runStart;
                }
            } else {
                runStart = -1;
                runLen = 0;
            }
        }
        if (bestLen > 1) {
            const head = groups.slice(0, bestStart).join(':');
            const tail = groups.slice(bestStart + bestLen).join(':');
            return `${head}::${tail}`;
        }
        return groups.join(':');
    }

    private readSMBIOSSerial() {
        const b = this.bindings;
        if (!b) {
            return '';
        }
        try {
            const RSMB = 0x52534D42;
            const size = b.getSystemFirmwareTable(RSMB, 0, null, 0);
            if (!size) {
                return '';
            }
            const buf = Buffer.alloc(size);
            if (!b.getSystemFirmwareTable(RSMB, 0, buf, size)) {
                return '';
            }
            let offset = 8;
            while (offset + 4 < size) {
                const type = buf.readUInt8(offset);
                const length = buf.readUInt8(offset + 1);
                if (type === 1 && length >= 0x19) {
                    const serialStart = offset + 0x08;
                    let end = serialStart;
                    while (end < size && buf[end] !== 0) {
                        end++;
                    }
                    return buf.toString('ascii', serialStart, end).trim() || '';
                }
                let next = offset + length;
                while (next + 1 < size && !(buf[next] === 0 && buf[next + 1] === 0)) {
                    next++;
                }
                offset = next + 2;
            }
        } catch (e) {
            log.warn('SMBIOS serial read failed', {error: e});
        }
        return '';
    }

    private mapInterfaceName(name: string) {
        const lower = name.toLowerCase();
        if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('wlan')) {
            return 'wifi';
        }
        if (lower.includes('ethernet') || lower.startsWith('eth')) {
            return 'ethernet';
        }
        if (lower.includes('cellular') || lower.includes('mobile')) {
            return 'cellular';
        }
        if (lower.includes('vpn') || lower.includes('tap') || lower.includes('wan miniport')) {
            return 'vpn';
        }
        return 'other';
    }
}
