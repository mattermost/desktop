// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';

import koffi from 'koffi';

import {Logger} from 'common/log';
import {isRoutableAddress} from 'main/utils';

import type {InterfaceType} from 'types/sessionAttributes';

import {SessionAttributeCollector} from './sessionAttributeCollector';

const log = new Logger('SessionAttributes/macSessionAttributeCollector');

const FRAMEWORKS = '/System/Library/Frameworks';
const kCFStringEncodingUTF8 = 0x08000100;
const TUNNEL_INTERFACE_PREFIXES = ['utun', 'ppp', 'tap', 'tun', 'wg', 'ipsec'];

const interfaceTypeMap: Record<string, InterfaceType> = {
    IEEE80211: 'wifi',
    Ethernet: 'ethernet',
    WWAN: 'cellular',
    PPP: 'vpn',
    L2TP: 'vpn',
    PPTP: 'vpn',
};

export class MacSessionAttributeCollector extends SessionAttributeCollector {
    private readonly bindings: ReturnType<MacSessionAttributeCollector['loadBindings']>;

    constructor() {
        super();
        this.bindings = this.loadBindings();
    }

    private loadBindings() {
        const CF = koffi.load(`${FRAMEWORKS}/CoreFoundation.framework/CoreFoundation`);
        const IOKit = koffi.load(`${FRAMEWORKS}/IOKit.framework/IOKit`);
        const SC = koffi.load(`${FRAMEWORKS}/SystemConfiguration.framework/SystemConfiguration`);

        return {
            cfStringGetLength: CF.func('long CFStringGetLength(void *str)'),
            cfStringGetMaximumSizeForEncoding: CF.func('long CFStringGetMaximumSizeForEncoding(long length, uint32 encoding)'),
            cfStringGetCString: CF.func('uint8 CFStringGetCString(void *str, _Out_ char *buf, long size, uint32 encoding)'),
            cfStringCreateWithCString: CF.func('void *CFStringCreateWithCString(void *alloc, const char *cstr, uint32 encoding)'),
            cfRelease: CF.func('void CFRelease(void *cf)'),
            cfArrayGetCount: CF.func('long CFArrayGetCount(void *array)'),
            cfArrayGetValueAtIndex: CF.func('void *CFArrayGetValueAtIndex(void *array, long idx)'),
            cfDictionaryGetValue: CF.func('void *CFDictionaryGetValue(void *dict, void *key)'),

            ioServiceMatching: IOKit.func('void *IOServiceMatching(const char *name)'),
            ioServiceGetMatchingService: IOKit.func('uint32 IOServiceGetMatchingService(uint32 master, void *match)'),
            ioRegistryEntryCreateCFProperty: IOKit.func('void *IORegistryEntryCreateCFProperty(uint32 entry, void *key, void *alloc, uint32 options)'),
            ioObjectRelease: IOKit.func('int IOObjectRelease(uint32 obj)'),

            scDynamicStoreCopyLocalHostName: SC.func('void *SCDynamicStoreCopyLocalHostName(void *store)'),
            scDynamicStoreCreate: SC.func('void *SCDynamicStoreCreate(void *alloc, void *name, void *cb, void *info)'),
            scDynamicStoreCopyValue: SC.func('void *SCDynamicStoreCopyValue(void *store, void *key)'),
            scPreferencesCreate: SC.func('void *SCPreferencesCreate(void *alloc, void *name, void *prefsID)'),
            scNetworkServiceCopy: SC.func('void *SCNetworkServiceCopy(void *prefs, void *serviceID)'),
            scNetworkServiceGetInterface: SC.func('void *SCNetworkServiceGetInterface(void *service)'),
            scNetworkInterfaceGetInterfaceType: SC.func('void *SCNetworkInterfaceGetInterfaceType(void *iface)'),
        };
    }

    getOSPlatform() {
        return 'macos';
    }

    getHardwareId(): string {
        return this.useCfRelease((release) => {
            const matching = this.bindings.ioServiceMatching('IOPlatformExpertDevice');
            const service = this.bindings.ioServiceGetMatchingService(0, matching);
            const propKey = this.createCfString('IOPlatformUUID');
            if (propKey) {
                release.push(propKey);
            }
            const prop = this.bindings.ioRegistryEntryCreateCFProperty(service, propKey, null, 0);
            if (prop) {
                release.push(prop);
            }
            return this.cfStringToJS(prop);
        }, (e) => {
            log.warn('IOKit property read failed', {error: e});
            return '';
        });
    }

    getClientIPAddress() {
        const primaryInterface = this.copyStateDictValue('State:/Network/Global/IPv4', 'PrimaryInterface', (value) => this.cfStringToJS(value));
        const addrs = os.networkInterfaces()[primaryInterface];
        if (!addrs) {
            return '';
        }
        const v4 = addrs.find((a) => !a.internal && a.family === 'IPv4');
        if (v4) {
            return v4.address;
        }
        const v6 = addrs.find((a) => !a.internal && a.family === 'IPv6');
        return v6?.address ?? '';
    }

    getClientFQDN() {
        const localStr = this.useCfRelease((release) => {
            const local = this.bindings.scDynamicStoreCopyLocalHostName(null);
            if (local) {
                release.push(local);
            }
            return this.cfStringToJS(local);
        }, (e) => {
            log.warn('SCDynamicStore read failed', {error: e});
            return os.hostname();
        });
        const searchDomain = this.copyStateDictValue('State:/Network/Global/DNS', 'SearchDomains', (searchArr) => {
            const count = Number(this.bindings.cfArrayGetCount(searchArr));
            if (count <= 0) {
                return '';
            }
            const firstDomain = this.bindings.cfArrayGetValueAtIndex(searchArr, 0);
            return this.cfStringToJS(firstDomain);
        });
        return searchDomain ? `${localStr}.${searchDomain}` : localStr;
    }

    getNetworkInterfaceType() {
        const primaryService = this.copyStateDictValue('State:/Network/Global/IPv4', 'PrimaryService', (value) => this.cfStringToJS(value));
        return this.useCfRelease((release) => {
            const prefsName = this.createCfString('mattermost-desktop');
            if (prefsName) {
                release.push(prefsName);
            }
            const prefs = this.bindings.scPreferencesCreate(null, prefsName, null);
            if (prefs) {
                release.push(prefs);
            }
            const serviceId = this.createCfString(primaryService);
            if (serviceId) {
                release.push(serviceId);
            }
            const service = this.bindings.scNetworkServiceCopy(prefs, serviceId);
            if (service) {
                release.push(service);
            }
            const iface = this.bindings.scNetworkServiceGetInterface(service);
            const typeStr = this.cfStringToJS(this.bindings.scNetworkInterfaceGetInterfaceType(iface));
            if (typeStr && interfaceTypeMap[typeStr]) {
                return interfaceTypeMap[typeStr];
            }
            return 'other';
        }, (e) => {
            log.warn('SCNetworkService lookup failed', {error: e});
            return '';
        });
    }

    getVPNActive() {
        const ifaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(ifaces)) {
            if (!addrs || !TUNNEL_INTERFACE_PREFIXES.some((prefix) => name.toLowerCase().startsWith(prefix))) {
                continue;
            }

            log.info('Checking VPN active for interface', {name, addrs});

            // TODO: I'm not super confident in this implementation since it just relies on the IP address
            // but it's the simplest and easiest way to check if a VPN is active
            if (addrs.some((a) => !a.internal && isRoutableAddress(a.family, a.address))) {
                return 'true';
            }
        }
        return 'false';
    }

    getMDMEnrolled(): string {
        // TODO: This doesn't work on MAS builds, and the below implementation is hacky, so we might just ignore it for now
        // const candidates = [
        //     `/Library/Managed Preferences/${os.userInfo().username}`,
        //     '/Library/Managed Preferences',
        //     '/var/db/ConfigurationProfiles/Store',
        // ];
        // for (const p of candidates) {
        //     try {
        //         if (existsSync(p) && readdirSync(p).length > 0) {
        //             return 'true';
        //         }
        //     } catch {
        //         // not readable
        //     }
        // }
        return 'false';
    }

    private copyStateDictValue(stateKey: string, valueKey: string, read: (value: unknown) => string): string {
        return this.useCfRelease((release) => {
            const storeName = this.createCfString('mattermost-desktop');
            if (storeName) {
                release.push(storeName);
            }
            const store = this.bindings.scDynamicStoreCreate(null, storeName, null, null);
            if (store) {
                release.push(store);
            }
            const dictKey = this.createCfString(stateKey);
            if (dictKey) {
                release.push(dictKey);
            }
            const dict = this.bindings.scDynamicStoreCopyValue(store, dictKey);
            if (dict) {
                release.push(dict);
            }
            const valueKeyCF = this.createCfString(valueKey);
            if (valueKeyCF) {
                release.push(valueKeyCF);
            }
            const value = this.bindings.cfDictionaryGetValue(dict, valueKeyCF);
            if (value) {
                return read(value);
            }
            return '';
        }, (e) => {
            log.warn('SCDynamicStore read failed', {stateKey, valueKey, error: e});
            return '';
        });
    }

    private cfStringToJS(cfStr: unknown): string {
        const b = this.bindings;
        if (!b || !cfStr) {
            return '';
        }
        const length = Number(b.cfStringGetLength(cfStr));
        const maxSize = Number(b.cfStringGetMaximumSizeForEncoding(length, kCFStringEncodingUTF8)) + 1;
        const buf = Buffer.alloc(maxSize);
        if (b.cfStringGetCString(cfStr, buf, maxSize, kCFStringEncodingUTF8)) {
            const str = buf.toString('utf8');
            const nullIdx = str.indexOf('\0');
            return nullIdx >= 0 ? str.slice(0, nullIdx) : str;
        }
        return '';
    }

    private createCfString(str: string): unknown {
        return this.bindings.cfStringCreateWithCString(null, str, kCFStringEncodingUTF8);
    }

    // Helper to make it easier to release CF objects once used
    // Anything that creates or copies an object must be released
    private useCfRelease<T>(func: (release: unknown[]) => T, err: (error: unknown) => T): T {
        const release: Array<() => void> = [];
        try {
            return func(release);
        } catch (e) {
            return err(e);
        } finally {
            release.forEach((r) => this.bindings.cfRelease(r));
        }
    }
}
