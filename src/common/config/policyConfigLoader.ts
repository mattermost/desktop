// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CFPrefValue} from 'cf-prefs';
import {getPreferenceValue as getCFPreferenceValue} from 'cf-prefs';
import type {RegistryValue} from 'registry-js';
import {HKEY, enumerateValues} from 'registry-js';

import {Logger} from 'common/log';

import type {RegistryConfig as RegistryConfigType, Server} from 'types/config';

const log = new Logger('PolicyConfigLoader');
const WINDOWS_REGISTRY_PATH = 'SOFTWARE\\Policies\\Mattermost';
const WINDOWS_REGISTRY_HIVE_LIST = [HKEY.HKEY_LOCAL_MACHINE, HKEY.HKEY_CURRENT_USER];

export class PolicyConfigLoader {
    getPolicyConfig = (): Partial<RegistryConfigType> => {
        return {
            servers: this.getServerList(),
            enableServerManagement: this.getSingleBooleanValue('EnableServerManagement'),
            enableUpdateNotifications: this.getSingleBooleanValue('EnableAutoUpdater'),
        };
    };

    getAppsUseLightTheme = (): boolean => {
        if (process.platform !== 'win32') {
            return true;
        }
        try {
            const results = enumerateValues(HKEY.HKEY_CURRENT_USER, 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize');
            if (!results || results.length === 0) {
                return true;
            }
            return results.find((item) => item.name === 'AppsUseLightTheme')?.data === 1;
        } catch (error) {
            log.debug('Error reading AppsUseLightTheme from registry', error);
            return true;
        }
    };

    private getServerList = (): Server[] => {
        switch (process.platform) {
        case 'win32':
            return this.getWindowsServerList();
        case 'darwin':
            return this.getMacOSServerList();
        default:
            return [];
        }
    };

    private getWindowsServerList = (): Server[] => {
        const results = this.getWindowsValues('DefaultServerList');
        return results.map((item) => ({name: item.name, url: item.data as string}));
    };

    private getMacOSServerList = (): Server[] => {
        const results = this.getMacOSValue('DefaultServerList') as Array<Record<string, string>> | undefined;
        return (results ?? []).map((item) => ({name: item.name, url: item.url}));
    };

    private getSingleBooleanValue = (valueName: string): boolean | undefined => {
        switch (process.platform) {
        case 'win32':
            return this.getWindowsSingleBooleanValue(valueName);
        case 'darwin':
            return this.getMacOSSingleValue(valueName) as boolean | undefined;
        default:
            return false;
        }
    };

    // Windows registry values are always numbers or strings, so we just check if the value is 1.
    private getWindowsSingleBooleanValue = (valueName: string): boolean | undefined => {
        const value = this.getWindowsSingleValue(valueName);
        return value === undefined ? undefined : value === 1;
    };

    private getMacOSSingleValue = (valueName: string): Exclude<CFPrefValue, CFPrefValue[]> | undefined =>
        this.getMacOSValue(valueName) as Exclude<CFPrefValue, CFPrefValue[]>;
    private getWindowsSingleValue = (valueName: string) => {
        // Windows provides 2 hives, so we need to get the value from both and return the first one
        // The first one is the local machine hive, which should take priority
        const results = this.getWindowsValues()?.filter((r) => r.name === valueName);
        return results?.pop()?.data;
    };

    private getWindowsValues = (key?: string) => {
        const results: RegistryValue[] = [];
        for (const hive of WINDOWS_REGISTRY_HIVE_LIST) {
            try {
                results.push(...enumerateValues(hive, key ? `${WINDOWS_REGISTRY_PATH}\\${key}` : WINDOWS_REGISTRY_PATH));
            } catch (e) {
                log.debug('Error accessing the registry', {hive, key}, e);
            }
        }
        return results;
    };

    private getMacOSValue = (valueName: string): CFPrefValue | undefined => {
        try {
            return getCFPreferenceValue(valueName);
        } catch (error) {
            log.warn(`Nothing retrieved for '${valueName}'`, {error});
            return undefined;
        }
    };
}

const policyConfigLoader = new PolicyConfigLoader();
export default policyConfigLoader;
