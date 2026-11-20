// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';

import {MacSessionAttributeCollector} from './macSessionAttributeCollector';

jest.mock('koffi', () => ({
    __esModule: true,
    default: {
        load: jest.fn(() => ({
            func: jest.fn(() => jest.fn()),
        })),
    },
}));

jest.mock('os', () => ({
    __esModule: true,
    default: {
        networkInterfaces: jest.fn(),
        hostname: jest.fn(),
    },
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

const osMock = jest.mocked(os);

type Bindings = Record<string, jest.Mock>;

describe('main/sessionAttributes/collector/macSessionAttributeCollector', () => {
    let collector: MacSessionAttributeCollector;
    let bindings: Bindings;
    let cfStrings: Map<unknown, string>;

    // Configures the CoreFoundation string bindings so cfStringToJS(ptr) resolves to value.
    const setCfString = (ptr: unknown, value: string) => cfStrings.set(ptr, value);

    beforeEach(() => {
        jest.clearAllMocks();
        cfStrings = new Map();

        collector = new MacSessionAttributeCollector();
        bindings = (collector as unknown as {bindings: Bindings}).bindings;

        bindings.cfStringCreateWithCString.mockImplementation((_alloc: unknown, str: string) => `cf:${str}`);
        bindings.cfRelease.mockReturnValue(undefined);
        bindings.cfStringGetLength.mockImplementation((s: unknown) => (cfStrings.get(s) ?? '').length);
        bindings.cfStringGetMaximumSizeForEncoding.mockImplementation((len: number) => len);
        bindings.cfStringGetCString.mockImplementation((s: unknown, buf: Buffer) => {
            const value = cfStrings.get(s);
            if (value === undefined) {
                return 0;
            }
            buf.write(`${value}\0`, 'utf8');
            return 1;
        });

        bindings.scDynamicStoreCreate.mockReturnValue('store');
        bindings.scDynamicStoreCopyValue.mockReturnValue('dict');
        bindings.cfDictionaryGetValue.mockReturnValue('value');
        bindings.scPreferencesCreate.mockReturnValue('prefs');
        bindings.scNetworkServiceCopy.mockReturnValue('service');
        bindings.scNetworkServiceGetInterface.mockReturnValue('iface');
        bindings.scNetworkInterfaceGetInterfaceType.mockReturnValue('typePtr');
        bindings.scDynamicStoreCopyLocalHostName.mockReturnValue('hostPtr');
        bindings.cfArrayGetCount.mockReturnValue(1);
        bindings.cfArrayGetValueAtIndex.mockReturnValue('domainPtr');
        bindings.ioServiceMatching.mockReturnValue('match');
        bindings.ioServiceGetMatchingService.mockReturnValue(1);
        bindings.ioRegistryEntryCreateCFProperty.mockReturnValue('propPtr');
    });

    describe('getHardwareId', () => {
        it('returns the decoded IOPlatformUUID', () => {
            setCfString('propPtr', 'ABC-123-UUID');
            expect(collector.getHardwareId()).toBe('ABC-123-UUID');
        });

        it('returns an empty string when the native call throws', () => {
            bindings.ioServiceMatching.mockImplementation(() => {
                throw new Error('boom');
            });
            expect(collector.getHardwareId()).toBe('');
        });
    });

    describe('getClientIPAddress', () => {
        it('returns the IPv4 address of the primary interface', () => {
            setCfString('value', 'en7');
            osMock.networkInterfaces.mockReturnValue({
                en7: [
                    {family: 'IPv6', internal: false, address: 'fe80::1'},
                    {family: 'IPv4', internal: false, address: '192.168.0.1'},
                ],
            } as never);
            expect(collector.getClientIPAddress()).toBe('192.168.0.1');
        });

        it('falls back to IPv6 when there is no routable IPv4', () => {
            setCfString('value', 'en7');
            osMock.networkInterfaces.mockReturnValue({
                en7: [
                    {family: 'IPv6', internal: false, address: 'fd00::1'},
                ],
            } as never);
            expect(collector.getClientIPAddress()).toBe('fd00::1');
        });

        it('ignores internal addresses', () => {
            setCfString('value', 'lo0');
            osMock.networkInterfaces.mockReturnValue({
                lo0: [
                    {family: 'IPv4', internal: true, address: '127.0.0.1'},
                ],
            } as never);
            expect(collector.getClientIPAddress()).toBe('');
        });

        it('returns an empty string when the primary interface has no addresses', () => {
            setCfString('value', 'en7');
            osMock.networkInterfaces.mockReturnValue({} as never);
            expect(collector.getClientIPAddress()).toBe('');
        });

        it('returns an empty string when there is no primary interface', () => {
            bindings.cfDictionaryGetValue.mockReturnValue(null);
            osMock.networkInterfaces.mockReturnValue({} as never);
            expect(collector.getClientIPAddress()).toBe('');
        });
    });

    describe('getNetworkInterfaceType', () => {
        it.each([
            ['Ethernet', 'ethernet'],
            ['IEEE80211', 'wifi'],
            ['WWAN', 'cellular'],
            ['PPP', 'vpn'],
        ])('maps interface type %s to %s', (nativeType, expected) => {
            setCfString('value', 'service-id');
            setCfString('typePtr', nativeType);
            expect(collector.getNetworkInterfaceType()).toBe(expected);
        });

        it('returns other for an unrecognized interface type', () => {
            setCfString('value', 'service-id');
            setCfString('typePtr', 'Bridge');
            expect(collector.getNetworkInterfaceType()).toBe('other');
        });

        it('returns an empty string when the native lookup throws', () => {
            setCfString('value', 'service-id');
            bindings.scNetworkServiceCopy.mockImplementation(() => {
                throw new Error('boom');
            });
            expect(collector.getNetworkInterfaceType()).toBe('');
        });
    });

    describe('getVPNActive', () => {
        it('returns true when a tunnel interface has a routable address', () => {
            osMock.networkInterfaces.mockReturnValue({
                en7: [{family: 'IPv4', internal: false, address: '192.168.0.1'}],
                utun5: [
                    {family: 'IPv6', internal: false, address: 'fe80::1'},
                    {family: 'IPv4', internal: false, address: '100.64.0.1'},
                ],
            } as never);
            expect(collector.getVPNActive()).toBe('true');
        });

        it('returns false when tunnel interfaces only have link-local addresses', () => {
            osMock.networkInterfaces.mockReturnValue({
                utun0: [{family: 'IPv6', internal: false, address: 'fe80::1'}],
                utun1: [{family: 'IPv6', internal: false, address: 'fe80::2'}],
            } as never);
            expect(collector.getVPNActive()).toBe('false');
        });

        it('returns false when no tunnel interfaces are present', () => {
            osMock.networkInterfaces.mockReturnValue({
                en7: [{family: 'IPv4', internal: false, address: '192.168.0.1'}],
            } as never);
            expect(collector.getVPNActive()).toBe('false');
        });

        it('ignores internal addresses on tunnel interfaces', () => {
            osMock.networkInterfaces.mockReturnValue({
                utun5: [{family: 'IPv4', internal: true, address: '127.0.0.1'}],
            } as never);
            expect(collector.getVPNActive()).toBe('false');
        });
    });

    describe('getClientFQDN', () => {
        it('combines the local host name with the primary search domain', () => {
            setCfString('hostPtr', 'mymac');
            setCfString('domainPtr', 'example.com');
            expect(collector.getClientFQDN()).toBe('mymac.example.com');
        });

        it('returns just the local host name when there is no search domain', () => {
            setCfString('hostPtr', 'mymac');
            bindings.cfArrayGetCount.mockReturnValue(0);
            expect(collector.getClientFQDN()).toBe('mymac');
        });

        it('falls back to os.hostname when the local host name lookup throws', () => {
            osMock.hostname.mockReturnValue('fallback-host');
            bindings.scDynamicStoreCopyLocalHostName.mockImplementation(() => {
                throw new Error('boom');
            });
            bindings.cfArrayGetCount.mockReturnValue(0);
            expect(collector.getClientFQDN()).toBe('fallback-host');
        });
    });
});
