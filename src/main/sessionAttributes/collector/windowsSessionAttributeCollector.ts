// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import koffi from 'koffi';
import {enumerateValues, HKEY} from 'registry-js';

import {Logger} from 'common/log';
import {isRoutableAddress} from 'main/utils';

import {SessionAttributeCollector} from './sessionAttributeCollector';

const log = new Logger('SessionAttributes/windowsSessionAttributeCollector');

const ComputerNameDnsFullyQualified = 3;

enum AddressFamily {
    UNSPEC = 0,
    INET = 2,
    INET6 = 23,
}

enum GaaFlag {
    SKIP_ANYCAST = 0x2,
    SKIP_MULTICAST = 0x4,
    SKIP_DNS_SERVER = 0x8,
}

enum IfType {
    ETHERNET_CSMACD = 6,
    PPP = 23,
    IEEE80211 = 71,
    TUNNEL = 131,
    WWANPP = 243,
    WWANPP2 = 244,
}

const GAA_FLAGS = GaaFlag.SKIP_ANYCAST | GaaFlag.SKIP_MULTICAST | GaaFlag.SKIP_DNS_SERVER;
const ERROR_BUFFER_OVERFLOW = 111;
const IF_OPER_STATUS_UP = 1;

// Matches adapter friendly names and descriptions for common VPN/tunnel software
// (e.g. Tailscale and WireGuard use Wintun virtual adapters that don't report a PPP/tunnel ifType).
const VPN_ADAPTER_PATTERN = /vpn|tailscale|wireguard|wintun|zerotier|openvpn|anyconnect|nordlynx|mullvad|proton|tunnel|tap-windows|\btap\b|\btun\b|\bwg\b/i;

// GetBestInterface takes an IPv4 destination as a network-byte-order DWORD; 8.8.8.8 is byte-order agnostic.
const PUBLIC_PROBE_ADDRESS = 0x08080808;

// Buffer sizes (in characters) for fixed-size Win32 string outputs.
const DNS_FQDN_MAX_LENGTH = 256;
const IP_ADDRESS_STRING_LENGTH = 46;
const GUID_STRING_LENGTH = 39;

const WLAN_CLIENT_VERSION = 2;
const WLAN_INTERFACE_STATE_CONNECTED = 1;
const WLAN_INTF_OPCODE_CURRENT_CONNECTION = 7;
const WLAN_INTERFACE_INFO_LIST_HEADER_SIZE = 8;

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

koffi.struct('MM_GUID', {
    data1: 'uint32',
    data2: 'uint16',
    data3: 'uint16',
    data4: koffi.array('uint8', 8),
});

// Full interface entry; only the connection state and GUID are used.
const wlanInterfaceInfo = koffi.struct('MM_WLAN_INTERFACE_INFO', {
    interfaceGuid: 'MM_GUID',
    strInterfaceDescription: koffi.array('uint16', 256),
    isState: 'int',
});

// List header only; entries are decoded individually by offset.
const wlanInterfaceInfoList = koffi.struct('MM_WLAN_INTERFACE_INFO_LIST', {
    numberOfItems: 'uint32',
    index: 'uint32',
});

const dot11Ssid = koffi.struct('MM_DOT11_SSID', {
    length: 'uint32',
    value: koffi.array('uint8', 32),
});

// Truncated after dot11Ssid; the trailing fields are not needed.
const wlanConnectionAttributes = koffi.struct('MM_WLAN_CONNECTION_ATTRIBUTES', {
    isState: 'int',
    wlanConnectionMode: 'int',
    strProfileName: koffi.array('uint16', 256),
    dot11Ssid,
});

type UnicastAddress = {family: string; address: string};

type AdapterInfo = {
    ifIndex: number;
    ifType: number;
    operStatus: number;
    friendlyName: string;
    description: string;
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

    private loadBindings() {
        const kernel32 = koffi.load('kernel32.dll');
        const iphlpapi = koffi.load('iphlpapi.dll');
        const wlanapi = koffi.load('wlanapi.dll');
        const ntdll = koffi.load('ntdll.dll');
        const ole32 = koffi.load('ole32.dll');

        return {
            getSystemFirmwareTable: kernel32.func('uint32 GetSystemFirmwareTable(uint32, uint32, void *pFirmwareTableBuffer, uint32 BufferSize)'),
            getComputerNameExW: kernel32.func('uint8 GetComputerNameExW(uint32, _Out_ uint16 *lpBuffer, uint32 *nSize)'),
            getBestInterface: iphlpapi.func('uint32 GetBestInterface(uint32 dwDestAddr, _Out_ uint32 *pdwBestIfIndex)'),
            getAdaptersAddresses: iphlpapi.func('uint32 GetAdaptersAddresses(uint32 Family, uint32 Flags, void *Reserved, void *AdapterAddresses, _Inout_ uint32 *SizePointer)'),
            rtlIpv4AddressToStringW: ntdll.func('void *RtlIpv4AddressToStringW(void *Addr, _Out_ uint16 *S)'),
            rtlIpv6AddressToStringW: ntdll.func('void *RtlIpv6AddressToStringW(void *Addr, _Out_ uint16 *S)'),
            stringFromGUID2: ole32.func('int StringFromGUID2(void *rguid, _Out_ uint16 *lpsz, int cchMax)'),
            wlanOpenHandle: wlanapi.func('uint32 WlanOpenHandle(uint32 dwClientVersion, void *pReserved, _Out_ uint32 *pdwNegotiatedVersion, _Out_ void **phClientHandle)'),
            wlanCloseHandle: wlanapi.func('uint32 WlanCloseHandle(void *hClientHandle, void *pReserved)'),
            wlanEnumInterfaces: wlanapi.func('uint32 WlanEnumInterfaces(void *hClientHandle, void *pReserved, _Out_ void **ppInterfaceList)'),
            wlanQueryInterface: wlanapi.func('uint32 WlanQueryInterface(void *hClientHandle, MM_GUID *pInterfaceGuid, int OpCode, void *pReserved, _Out_ uint32 *pdwDataSize, _Out_ void **ppData, void *pWlanOpcodeValueType)'),
            wlanFreeMemory: wlanapi.func('void WlanFreeMemory(void *pMemory)'),
        };
    }

    getOSPlatform() {
        return 'windows';
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

    getHardwareId() {
        if (!this.bindings) {
            return '';
        }
        try {
            // "RSMB" as an ASCII encoded byte string.
            const RSMB = 0x52534D42;
            const size = this.bindings.getSystemFirmwareTable(RSMB, 0, null, 0);
            if (!size) {
                return '';
            }
            const buf = Buffer.alloc(size);
            if (!this.bindings.getSystemFirmwareTable(RSMB, 0, buf, size)) {
                return '';
            }

            return this.getSMBIOSUUIDFromSystemFirmwareTableBuffer(buf, size);
        } catch (error) {
            log.warn('SMBIOS UUID read failed', {error});
            return '';
        }
    }

    private getSMBIOSUUIDFromSystemFirmwareTableBuffer(buf: Buffer, size: number) {
        if (!this.bindings) {
            return '';
        }

        // Skip the 8-byte RawSMBIOSData header, then walk each structure looking
        // for Type 1 (System Information), whose UUID matches Win32_ComputerSystemProduct.UUID.
        let offset = 8;
        while (offset + 4 < size) {
            const type = buf.readUInt8(offset);
            const length = buf.readUInt8(offset + 1);

            // The UUID is a 16-byte binary field at offset 0x08 of the Type 1 structure.
            if (type === 1 && length >= 0x18 && offset + 0x18 <= size) {
                const bytes = buf.subarray(offset + 0x08, offset + 0x18);
                // An all-zero or all-0xFF UUID indicates the system did not provide one.
                if (bytes.every((byte) => byte === 0x00) || bytes.every((byte) => byte === 0xFF)) {
                    return '';
                }

                // StringFromGUID2 reads the leading fields as little-endian integers, matching the
                // byte order Windows reports via Win32_ComputerSystemProduct.UUID.
                const stringBuf = Buffer.alloc(GUID_STRING_LENGTH * 2);
                if (!this.bindings.stringFromGUID2(bytes, stringBuf, GUID_STRING_LENGTH)) {
                    return '';
                }

                // The result is wrapped in braces; casing is normalized to match WMI.
                return koffi.decode.string16(stringBuf).replace(/[{}]/g, '').toUpperCase();
            }

            // Advance past the formatted area and the double-null-terminated string set.
            let next = offset + length;
            while (next + 1 < size && !(buf[next] === 0 && buf[next + 1] === 0)) {
                next++;
            }
            offset = next + 2;
        }

        return '';
    }

    getClientIPAddress() {
        const bestIndex = this.getBestInterfaceIndex();
        const adapters = this.enumerateAdapters();
        const preferred = adapters.find((adapter) => adapter.ifIndex === bestIndex);
        const candidates = preferred ? [preferred] : adapters.filter((adapter) => adapter.operStatus === IF_OPER_STATUS_UP);
        for (const family of ['IPv4', 'IPv6']) {
            for (const adapter of candidates) {
                const match = adapter.addresses.find((addr) => 
                    addr.family === family &&
                    isRoutableAddress(addr.family, addr.address),
                );
                if (match) {
                    return match.address;
                }
            }
        }
        return '';
    }

    getClientFQDN() {
        if (!this.bindings) {
            return '';
        }
        try {
            // A DNS FQDN never exceeds 255 characters, so a fixed buffer avoids the size-probe call.
            const nameBuf = Buffer.alloc(DNS_FQDN_MAX_LENGTH * 2);
            const size = [DNS_FQDN_MAX_LENGTH];
            if (!this.bindings.getComputerNameExW(ComputerNameDnsFullyQualified, nameBuf, size)) {
                return '';
            }
            return koffi.decode.string16(nameBuf);
        } catch (error) {
            log.warn('GetComputerNameExW failed', {error});
            return '';
        }
    }

    getNetworkInterfaceType() {
        const bestIndex = this.getBestInterfaceIndex();
        const adapters = this.enumerateAdapters();
        const preferred = adapters.find((adapter) => adapter.ifIndex === bestIndex) ??
            adapters.find((adapter) => adapter.operStatus === IF_OPER_STATUS_UP &&
                adapter.addresses.some((addr) => isRoutableAddress(addr.family, addr.address)));
        if (!preferred) {
            return '';
        }
        if (this.isVpnAdapter(preferred)) {
            return 'vpn';
        }
        switch (preferred.ifType) {
        case IfType.IEEE80211:
            return 'wifi';
        case IfType.ETHERNET_CSMACD:
            return 'ethernet';
        case IfType.WWANPP:
        case IfType.WWANPP2:
            return 'cellular';
        default:
            return 'other';
        }
    }

    getSSID() {
        if (!this.bindings) {
            return '';
        }
        let clientHandle: unknown;
        let interfaceList: unknown;
        try {
            const negotiatedVersion = [0];
            const handleOut = [null];
            if (this.bindings.wlanOpenHandle(WLAN_CLIENT_VERSION, null, negotiatedVersion, handleOut) !== 0) {
                return '';
            }
            clientHandle = handleOut[0];

            const listOut = [null];
            if (this.bindings.wlanEnumInterfaces(clientHandle, null, listOut) !== 0) {
                return '';
            }
            interfaceList = listOut[0];

            const {numberOfItems} = koffi.decode(interfaceList, wlanInterfaceInfoList);
            const infoSize = koffi.sizeof(wlanInterfaceInfo);
            for (let i = 0; i < numberOfItems; i++) {
                const info = koffi.decode(interfaceList, WLAN_INTERFACE_INFO_LIST_HEADER_SIZE + (i * infoSize), wlanInterfaceInfo);
                if (info.isState !== WLAN_INTERFACE_STATE_CONNECTED) {
                    continue;
                }

                // WlanQueryInterface allocates a buffer per call that must be freed individually.
                let connectionData: unknown;
                try {
                    const dataSize = [0];
                    const dataOut = [null];
                    if (this.bindings.wlanQueryInterface(
                        clientHandle,
                        info.interfaceGuid,
                        WLAN_INTF_OPCODE_CURRENT_CONNECTION,
                        null,
                        dataSize,
                        dataOut,
                        null,
                    ) !== 0) {
                        continue;
                    }
                    connectionData = dataOut[0];
                    if (!connectionData) {
                        continue;
                    }
                    const {dot11Ssid: connectedSsid} = koffi.decode(connectionData, wlanConnectionAttributes);
                    if (connectedSsid.length > 0) {
                        return Buffer.from(connectedSsid.value.slice(0, connectedSsid.length)).toString('utf8');
                    }
                } finally {
                    if (connectionData) {
                        this.bindings.wlanFreeMemory(connectionData);
                    }
                }
            }
            return '';
        } catch (error) {
            log.warn('WLAN SSID lookup failed', {error});
            return '';
        } finally {
            if (interfaceList) {
                this.bindings.wlanFreeMemory(interfaceList);
            }
            if (clientHandle) {
                this.bindings.wlanCloseHandle(clientHandle, null);
            }
        }
    }

    getVPNActive() {
        const bestIndex = this.getBestInterfaceIndex();
        const adapters = this.enumerateAdapters();
        for (const adapter of adapters) {
            if (adapter.operStatus !== IF_OPER_STATUS_UP || !this.isVpnAdapter(adapter)) {
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

    private getBestInterfaceIndex(): number {
        if (!this.bindings) {
            return 0;
        }
        try {
            const indexOut = [0];
            if (this.bindings.getBestInterface(PUBLIC_PROBE_ADDRESS, indexOut) !== 0) {
                return 0;
            }
            return indexOut[0];
        } catch (error) {
            log.warn('GetBestInterface failed', {error});
            return 0;
        }
    }

    private enumerateAdapters(): AdapterInfo[] {
        if (!this.bindings) {
            return [];
        }
        try {
            const sizeOut = [0];
            if (this.bindings.getAdaptersAddresses(AddressFamily.UNSPEC, GAA_FLAGS, null, null, sizeOut) !== ERROR_BUFFER_OVERFLOW || !sizeOut[0]) {
                return [];
            }
            const buffer = Buffer.alloc(sizeOut[0]);
            sizeOut[0] = buffer.length;
            if (this.bindings.getAdaptersAddresses(AddressFamily.UNSPEC, GAA_FLAGS, null, buffer, sizeOut) !== 0) {
                return [];
            }
            const adapters: AdapterInfo[] = [];
            let cursor: unknown = buffer;
            while (cursor) {
                const node = koffi.decode(cursor, ipAdapterAddresses);
                const addresses: UnicastAddress[] = [];
                let unicastCursor = node.firstUnicastAddress;
                while (unicastCursor) {
                    const entry = koffi.decode(unicastCursor, ipAdapterUnicastAddress);
                    const sockaddr = entry.address.lpSockaddr;
                    if (sockaddr) {
                        const family = koffi.decode(sockaddr, 'uint16');
                        if (family === AddressFamily.INET) {
                            const sa = koffi.decode(sockaddr, sockaddrIn);
                            addresses.push({family: 'IPv4', address: this.formatAddress('IPv4', sa.addr)});
                        } else if (family === AddressFamily.INET6) {
                            const sa = koffi.decode(sockaddr, sockaddrIn6);
                            addresses.push({family: 'IPv6', address: this.formatAddress('IPv6', sa.addr)});
                        }
                    }
                    unicastCursor = entry.next;
                }
                adapters.push({
                    ifIndex: node.ifIndex,
                    ifType: node.ifType,
                    operStatus: node.operStatus,
                    friendlyName: node.friendlyName ? koffi.decode.string16(node.friendlyName) : '',
                    description: node.description ? koffi.decode.string16(node.description) : '',
                    addresses,
                });
                cursor = node.next;
            }
            return adapters;
        } catch (error) {
            log.warn('GetAdaptersAddresses failed', {error});
            return [];
        }
    }

    private formatAddress(family: 'IPv4' | 'IPv6', addr: number[]): string {
        if (!this.bindings) {
            return '';
        }
        const addrBuf = Buffer.from(addr);
        const stringBuf = Buffer.alloc(IP_ADDRESS_STRING_LENGTH * 2);
        if (family === 'IPv4') {
            this.bindings.rtlIpv4AddressToStringW(addrBuf, stringBuf);
        } else {
            this.bindings.rtlIpv6AddressToStringW(addrBuf, stringBuf);
        }
        return koffi.decode.string16(stringBuf);
    }

    private isVpnAdapter(adapter: AdapterInfo): boolean {
        if (adapter.ifType === IfType.PPP || adapter.ifType === IfType.TUNNEL) {
            return true;
        }
        return VPN_ADAPTER_PATTERN.test(adapter.friendlyName) || VPN_ADAPTER_PATTERN.test(adapter.description);
    }
}
