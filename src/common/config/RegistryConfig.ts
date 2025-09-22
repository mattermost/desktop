// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';
import type {RegistryValue} from 'registry-js';
import {HKEY, enumerateValues} from 'registry-js';

import {Logger} from 'common/log';

import type {RegistryConfig as RegistryConfigType, Server} from 'types/config';

const log = new Logger('RegistryConfig');
const REGISTRY_HIVE_LIST = [HKEY.HKEY_LOCAL_MACHINE, HKEY.HKEY_CURRENT_USER];
const BASE_REGISTRY_KEY_PATH = 'SOFTWARE\\Policies\\Mattermost';
export const REGISTRY_READ_EVENT = 'registry-read';

/**
 * Handles loading config data from the Windows registry set manually or by GPO
 */
export default class RegistryConfig extends EventEmitter {
    initialized: boolean;
    data: Partial<RegistryConfigType>;

    constructor() {
        super();
        this.initialized = false;
        this.data = {
            servers: [],
        };
    }

    /**
   * Triggers loading data from Windows registry
   *
   * @emits {update} emitted once all data has been loaded from the registry
   */
    init() {
        if (process.platform === 'win32') {
            // extract DefaultServerList from the registry
            try {
                const servers = this.getServersListFromRegistry();
                if (servers.length) {
                    this.data.servers!.push(...servers);
                }
            } catch (error) {
                log.warn('Nothing retrieved for \'DefaultServerList\'', {error});
            }

            // extract EnableServerManagement from the registry
            try {
                const enableServerManagement = this.getEnableServerManagementFromRegistry();
                if (enableServerManagement !== undefined) {
                    this.data.enableServerManagement = enableServerManagement;
                }
            } catch (error) {
                log.warn('Nothing retrieved for \'EnableServerManagement\'', {error});
            }

            // extract EnableAutoUpdater from the registry
            try {
                const enableAutoUpdater = this.getEnableAutoUpdatorFromRegistry();
                if (enableAutoUpdater !== undefined) {
                    this.data.enableAutoUpdater = enableAutoUpdater;
                }
            } catch (error) {
                log.warn('Nothing retrieved for \'EnableAutoUpdater\'', {error});
            }
        }

        // this will happen wether we are on windows and load the info or not
        this.initialized = true;
        this.emit(REGISTRY_READ_EVENT, this.data);
    }

    /**
   * Extracts a list of servers
   */
    private getServersListFromRegistry() {
        const defaultServers = this.getRegistryEntry(`${BASE_REGISTRY_KEY_PATH}\\DefaultServerList`);
        return defaultServers.flat(2).reduce((servers: Server[], server) => {
            if (server) {
                servers.push({
                    name: (server as RegistryValue).name,
                    url: (server as RegistryValue).data as string,
                });
            }
            return servers;
        }, []);
    }

    /**
   * Determines whether server management has been enabled, disabled or isn't configured
   */
    private getEnableServerManagementFromRegistry() {
        const value = this.getRegistryEntry(BASE_REGISTRY_KEY_PATH, 'EnableServerManagement').pop();
        return value === undefined ? value : value === 1;
    }

    /**
   * Determines whether the auto updated has been enabled, disabled or isn't configured
   */
    private getEnableAutoUpdatorFromRegistry() {
        const value = this.getRegistryEntry(BASE_REGISTRY_KEY_PATH, 'EnableAutoUpdater').pop();
        return value === undefined ? value : value === 1;
    }

    /**
   * Initiates retrieval of a specific key in the Windows registry
   *
   * @param {string} key Path to the registry key to return
   * @param {string} name Name of specific entry in the registry key to retrieve (optional)
   */
    private getRegistryEntry(key: string, name?: string) {
        const results = [];
        for (const hive of REGISTRY_HIVE_LIST) {
            results.push(this.getRegistryEntryValues(hive, key, name));
        }
        return results.filter((value) => value !== undefined);
    }

    /**
   * Handles actual retrieval of entries from a configured WindowsRegistry instance
   *
   * @param {WindowsRegistry} regKey A configured instance of the WindowsRegistry class
   * @param {string} name Name of the specific entry to retrieve (optional)
   */
    private getRegistryEntryValues(hive: HKEY, key: string, name?: string) {
        try {
            const results = enumerateValues(hive, key);
            if (!results || results.length === 0) {
                return undefined;
            }
            if (name) { // looking for a single entry value
                return results.find((item) => item.name === name)?.data;
            }

            // looking for an entry list
            return results;
        } catch (e) {
            log.debug('There was an error accessing the registry for', {hive, key, name}, e);
            return undefined;
        }
    }
}
