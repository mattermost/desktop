// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import koffi from 'koffi';
import {enumerateValues} from 'registry-js';

import {WindowsSessionAttributeCollector} from './windowsSessionAttributeCollector';

jest.mock('koffi', () => {
    const decode = Object.assign(
        jest.fn(),
        {
            string16: jest.fn((buf: Buffer) => {
                if (!Buffer.isBuffer(buf)) {
                    return '';
                }
                const text = buf.toString('utf16le');
                const end = text.indexOf('\u0000');
                return end === -1 ? text : text.slice(0, end);
            }),
        },
    );
    return {
        load: jest.fn(() => ({func: jest.fn(() => jest.fn())})),
        struct: jest.fn((name: unknown) => (typeof name === 'string' ? name : 'anonymous')),
        array: jest.fn(() => 'array'),
        sizeof: jest.fn(() => 8),
        decode,
    };
});

jest.mock('registry-js', () => ({
    __esModule: true,
    enumerateValues: jest.fn(),
    HKEY: {HKEY_LOCAL_MACHINE: 'HKEY_LOCAL_MACHINE'},
}));

jest.mock('common/log', () => ({
    __esModule: true,
    Logger: jest.fn().mockImplementation(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        silly: jest.fn(),
    })),
}));

jest.mock('main/utils', () => ({
    isRoutableAddress: (family: string, address: string) => {
        const ip = address.split('%')[0].toLowerCase();
        const linkLocal = family === 'IPv4' ? ip.startsWith('169.254.') : ip.startsWith('fe80:');
        return !linkLocal && address !== '0.0.0.0';
    },
}));

jest.mock('electron', () => ({
    __esModule: true,
    app: {getVersion: jest.fn(() => '5.0.0')},
}));

jest.mock('common/servers/serverManager', () => ({
    __esModule: true,
    default: {getServer: jest.fn()},
}));

type Bindings = Record<string, jest.Mock>;

type TestAddress = {family: 'IPv4' | 'IPv6'; address: string};

type TestAdapter = {
    ifIndex: number;
    ifType: number;
    operStatus: number;
    friendlyName: string;
    description: string;
    addresses: TestAddress[];
};

// Mirrors the module's internal IfType enum values.
const IF_TYPE = {
    ETHERNET: 6,
    PPP: 23,
    WIFI: 71,
    TUNNEL: 131,
    WWANPP: 243,
    WWANPP2: 244,
};
const OPER_UP = 1;
const OPER_DOWN = 2;

const decodeMock = koffi.decode as unknown as jest.Mock;
const sizeofMock = koffi.sizeof as unknown as jest.Mock;
const enumerateValuesMock = jest.mocked(enumerateValues);

// Builds a single SMBIOS structure: 4-byte header, formatted area, then an empty (double-null) string set.
const buildStructure = (type: number, length: number, uuid?: Buffer) => {
    const formatted = Buffer.alloc(length);
    formatted.writeUInt8(type, 0);
    formatted.writeUInt8(length, 1);
    if (uuid) {
        uuid.copy(formatted, 0x08);
    }
    return Buffer.concat([formatted, Buffer.from([0x00, 0x00])]);
};

// Wraps structures in the 8-byte RawSMBIOSData header the walk skips.
const buildSmbios = (...structures: Buffer[]) => Buffer.concat([Buffer.alloc(8), ...structures]);

describe('main/sessionAttributes/collector/windowsSessionAttributeCollector', () => {
    let collector: WindowsSessionAttributeCollector;
    let bindings: Bindings;

    const stubNetwork = (adapters: TestAdapter[], bestIndex: number) => {
        const target = collector as unknown as {
            enumerateAdapters: () => TestAdapter[];
            getBestInterfaceIndex: () => number;
        };
        target.enumerateAdapters = () => adapters;
        target.getBestInterfaceIndex = () => bestIndex;
    };

    const makeAdapter = (overrides: Partial<TestAdapter> = {}): TestAdapter => ({
        ifIndex: 1,
        ifType: IF_TYPE.ETHERNET,
        operStatus: OPER_UP,
        friendlyName: 'Ethernet',
        description: 'Ethernet Adapter',
        addresses: [],
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        collector = new WindowsSessionAttributeCollector();
        bindings = (collector as unknown as {bindings: Bindings}).bindings;
    });

    describe('getOSPlatform', () => {
        it('returns windows', () => {
            expect(collector.getOSPlatform()).toBe('windows');
        });
    });

    describe('getMDMEnrolled', () => {
        it('returns true when enrollment keys exist', () => {
            enumerateValuesMock.mockReturnValue([{name: 'enrollment'}] as never);
            expect(collector.getMDMEnrolled()).toBe('true');
        });

        it('returns false when there are no enrollment keys', () => {
            enumerateValuesMock.mockReturnValue([] as never);
            expect(collector.getMDMEnrolled()).toBe('false');
        });

        it('returns an empty string when the registry read throws', () => {
            enumerateValuesMock.mockImplementation(() => {
                throw new Error('boom');
            });
            expect(collector.getMDMEnrolled()).toBe('');
        });
    });

    describe('getHardwareId', () => {
        const uuidBytes = Buffer.from([
            0x78, 0x56, 0x34, 0x12,
            0x34, 0x12,
            0x34, 0x12,
            0x12, 0x34,
            0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0,
        ]);

        const provideTable = (table: Buffer) => {
            bindings.getSystemFirmwareTable.mockImplementation((_sig: unknown, _id: unknown, buf: unknown) => {
                if (!buf) {
                    return table.length;
                }
                table.copy(buf as Buffer);
                return 1;
            });
        };

        beforeEach(() => {
            bindings.stringFromGUID2.mockImplementation((_rguid: unknown, out: unknown) => {
                (out as Buffer).write('{12345678-1234-1234-1234-123456789abc}\u0000', 'utf16le');
                return 39;
            });
        });

        it('walks the SMBIOS table and returns the normalized UUID', () => {
            // A leading Type 0 (BIOS) structure verifies the walk advances to Type 1.
            provideTable(buildSmbios(
                buildStructure(0, 0x14),
                buildStructure(1, 0x1b, uuidBytes),
            ));
            expect(collector.getHardwareId()).toBe('12345678-1234-1234-1234-123456789ABC');
        });

        it('returns an empty string for an all-zero UUID', () => {
            provideTable(buildSmbios(buildStructure(1, 0x1b, Buffer.alloc(16, 0x00))));
            expect(collector.getHardwareId()).toBe('');
        });

        it('returns an empty string for an all-0xFF UUID', () => {
            provideTable(buildSmbios(buildStructure(1, 0x1b, Buffer.alloc(16, 0xff))));
            expect(collector.getHardwareId()).toBe('');
        });

        it('returns an empty string when no Type 1 structure is present', () => {
            provideTable(buildSmbios(buildStructure(0, 0x14)));
            expect(collector.getHardwareId()).toBe('');
        });

        it('returns an empty string when the firmware table is unavailable', () => {
            bindings.getSystemFirmwareTable.mockReturnValue(0);
            expect(collector.getHardwareId()).toBe('');
        });

        it('returns an empty string when the native call throws', () => {
            bindings.getSystemFirmwareTable.mockImplementation(() => {
                throw new Error('boom');
            });
            expect(collector.getHardwareId()).toBe('');
        });
    });

    describe('getClientFQDN', () => {
        it('returns the fully qualified computer name', () => {
            bindings.getComputerNameExW.mockImplementation((_type: unknown, buf: unknown) => {
                (buf as Buffer).write('host.example.com\u0000', 'utf16le');
                return 1;
            });
            expect(collector.getClientFQDN()).toBe('host.example.com');
        });

        it('returns an empty string when the name lookup fails', () => {
            bindings.getComputerNameExW.mockReturnValue(0);
            expect(collector.getClientFQDN()).toBe('');
        });

        it('returns an empty string when the native call throws', () => {
            bindings.getComputerNameExW.mockImplementation(() => {
                throw new Error('boom');
            });
            expect(collector.getClientFQDN()).toBe('');
        });
    });

    describe('getClientIPAddress', () => {
        it('returns the IPv4 address of the best-route adapter, preferring IPv4 over IPv6', () => {
            stubNetwork([
                makeAdapter({
                    ifIndex: 5,
                    addresses: [
                        {family: 'IPv6', address: 'fd00::1'},
                        {family: 'IPv4', address: '192.168.0.1'},
                    ],
                }),
            ], 5);
            expect(collector.getClientIPAddress()).toBe('192.168.0.1');
        });

        it('falls back to IPv6 when the adapter has no routable IPv4', () => {
            stubNetwork([
                makeAdapter({ifIndex: 5, addresses: [{family: 'IPv6', address: 'fd00::1'}]}),
            ], 5);
            expect(collector.getClientIPAddress()).toBe('fd00::1');
        });

        it('uses any UP adapter when the best-route index matches none', () => {
            stubNetwork([
                makeAdapter({ifIndex: 1, addresses: [{family: 'IPv4', address: '10.0.0.5'}]}),
            ], 99);
            expect(collector.getClientIPAddress()).toBe('10.0.0.5');
        });

        it('ignores non-routable addresses on the best-route adapter and does not fall back', () => {
            stubNetwork([
                makeAdapter({ifIndex: 5, addresses: [{family: 'IPv4', address: '169.254.1.1'}]}),
                makeAdapter({ifIndex: 6, addresses: [{family: 'IPv4', address: '192.168.0.1'}]}),
            ], 5);
            expect(collector.getClientIPAddress()).toBe('');
        });

        it('returns an empty string when there are no adapters', () => {
            stubNetwork([], 0);
            expect(collector.getClientIPAddress()).toBe('');
        });
    });

    describe('getNetworkInterfaceType', () => {
        it.each([
            [IF_TYPE.WIFI, 'wifi'],
            [IF_TYPE.ETHERNET, 'ethernet'],
            [IF_TYPE.WWANPP, 'cellular'],
            [IF_TYPE.WWANPP2, 'cellular'],
            [9999, 'other'],
        ])('maps ifType %s to %s', (ifType, expected) => {
            stubNetwork([makeAdapter({ifIndex: 5, ifType})], 5);
            expect(collector.getNetworkInterfaceType()).toBe(expected);
        });

        it('classifies a tunnel adapter as vpn regardless of ifType', () => {
            stubNetwork([makeAdapter({ifIndex: 5, ifType: IF_TYPE.TUNNEL})], 5);
            expect(collector.getNetworkInterfaceType()).toBe('vpn');
        });

        it('classifies an adapter matching the VPN name pattern as vpn', () => {
            stubNetwork([makeAdapter({ifIndex: 5, ifType: IF_TYPE.ETHERNET, friendlyName: 'Tailscale'})], 5);
            expect(collector.getNetworkInterfaceType()).toBe('vpn');
        });

        it('returns an empty string when there is no primary adapter', () => {
            stubNetwork([], 0);
            expect(collector.getNetworkInterfaceType()).toBe('');
        });
    });

    describe('getVPNActive', () => {
        it('returns true when the best-route adapter is a VPN adapter', () => {
            stubNetwork([makeAdapter({ifIndex: 5, ifType: IF_TYPE.TUNNEL})], 5);
            expect(collector.getVPNActive()).toBe('true');
        });

        it('returns true when a VPN adapter has a routable address but is not the best route', () => {
            stubNetwork([
                makeAdapter({ifIndex: 5, friendlyName: 'Ethernet'}),
                makeAdapter({
                    ifIndex: 6,
                    friendlyName: 'WireGuard Tunnel',
                    addresses: [{family: 'IPv4', address: '100.64.0.1'}],
                }),
            ], 5);
            expect(collector.getVPNActive()).toBe('true');
        });

        it('returns false when a VPN adapter only has link-local addresses', () => {
            stubNetwork([
                makeAdapter({
                    ifIndex: 6,
                    friendlyName: 'WireGuard Tunnel',
                    addresses: [{family: 'IPv6', address: 'fe80::1'}],
                }),
            ], 5);
            expect(collector.getVPNActive()).toBe('false');
        });

        it('ignores VPN adapters that are down', () => {
            stubNetwork([
                makeAdapter({
                    ifIndex: 5,
                    ifType: IF_TYPE.TUNNEL,
                    operStatus: OPER_DOWN,
                }),
            ], 5);
            expect(collector.getVPNActive()).toBe('false');
        });

        it('returns false when no VPN adapter is present', () => {
            stubNetwork([makeAdapter({ifIndex: 5})], 5);
            expect(collector.getVPNActive()).toBe('false');
        });
    });

    describe('getSSID', () => {
        type WlanState = {numberOfItems: number; isState: number; ssid: {length: number; value: number[]}};
        let wlan: WlanState;

        beforeEach(() => {
            wlan = {
                numberOfItems: 1,
                isState: 1,
                ssid: {length: 5, value: [0x48, 0x45, 0x4c, 0x4c, 0x4f]},
            };

            sizeofMock.mockReturnValue(8);
            decodeMock.mockImplementation((...args: unknown[]) => {
                const type = args.length >= 3 ? args[2] : args[1];
                switch (type) {
                case 'MM_WLAN_INTERFACE_INFO_LIST':
                    return {numberOfItems: wlan.numberOfItems};
                case 'MM_WLAN_INTERFACE_INFO':
                    return {isState: wlan.isState, interfaceGuid: {}};
                case 'MM_WLAN_CONNECTION_ATTRIBUTES':
                    return {dot11Ssid: wlan.ssid};
                default:
                    return {};
                }
            });

            bindings.wlanOpenHandle.mockImplementation((_v: unknown, _r: unknown, _neg: unknown, handleOut: unknown) => {
                (handleOut as unknown[])[0] = 'handle';
                return 0;
            });
            bindings.wlanEnumInterfaces.mockImplementation((_h: unknown, _r: unknown, listOut: unknown) => {
                (listOut as unknown[])[0] = 'list';
                return 0;
            });
            bindings.wlanQueryInterface.mockImplementation((_h: unknown, _g: unknown, _op: unknown, _r: unknown, _size: unknown, dataOut: unknown) => {
                (dataOut as unknown[])[0] = 'data';
                return 0;
            });
        });

        it('returns the SSID of the connected interface', () => {
            expect(collector.getSSID()).toBe('HELLO');
        });

        it('returns an empty string when no interface is connected', () => {
            wlan.isState = 0;
            expect(collector.getSSID()).toBe('');
        });

        it('returns an empty string when the WLAN handle cannot be opened', () => {
            bindings.wlanOpenHandle.mockReturnValue(1);
            expect(collector.getSSID()).toBe('');
        });
    });
});
