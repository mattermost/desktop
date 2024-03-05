// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';
import WindowsRegistry from 'winreg';
import WindowsRegistryUTF8 from 'winreg-utf8';

import {Logger} from 'common/log';

import type {RegistryConfig as RegistryConfigType, Server} from 'types/config';

const log = new Logger('RegistryConfig');
const REGISTRY_HIVE_LIST = [WindowsRegistry.HKLM, WindowsRegistry.HKCU];
const BASE_REGISTRY_KEY_PATH = '\\Software\\Policies\\Mattermost';
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
   * Triggers loading data from Windows registry, supports async/await
   *
   * @emits {update} emitted once all data has been loaded from the registry
   */
    async init() {
        if (process.platform === 'win32') {
            // extract DefaultServerList from the registry
            try {
                const servers = await this.getServersListFromRegistry();
                if (servers.length) {
                    this.data.servers!.push(...servers);
                }
            } catch (error) {
                log.warn('Nothing retrieved for \'DefaultServerList\'', error);
            }

            // extract EnableServerManagement from the registry
            try {
                const enableServerManagement = await this.getEnableServerManagementFromRegistry();
                if (enableServerManagement !== null) {
                    this.data.enableServerManagement = enableServerManagement;
                }
            } catch (error) {
                log.warn('Nothing retrieved for \'EnableServerManagement\'', error);
            }

            // extract EnableAutoUpdater from the registry
            try {
                const enableAutoUpdater = await this.getEnableAutoUpdatorFromRegistry();
                if (enableAutoUpdater !== null) {
                    this.data.enableAutoUpdater = enableAutoUpdater;
                }
            } catch (error) {
                log.warn('Nothing retrieved for \'EnableAutoUpdater\'', error);
            }
        }

        // this will happen wether we are on windows and load the info or not
        this.initialized = true;
        this.emit(REGISTRY_READ_EVENT, this.data);
    }

    /**
   * Extracts a list of servers
   */
    async getServersListFromRegistry() {
        const defaultServers = await this.getRegistryEntry(`${BASE_REGISTRY_KEY_PATH}\\DefaultServerList`);
        return defaultServers.flat(2).reduce((servers: Server[], server) => {
            if (server) {
                servers.push({
                    name: (server as WindowsRegistry.RegistryItem).name,
                    url: (server as WindowsRegistry.RegistryItem).value,
                });
            }
            return servers;
        }, []);
    }

    /**
   * Determines whether server management has been enabled, disabled or isn't configured
   */
    async getEnableServerManagementFromRegistry() {
        const entries = (await this.getRegistryEntry(BASE_REGISTRY_KEY_PATH, 'EnableServerManagement'));
        const entry = entries.pop();
        return entry ? entry === '0x1' : null;
    }

    /**
   * Determines whether the auto updated has been enabled, disabled or isn't configured
   */
    async getEnableAutoUpdatorFromRegistry() {
        const entries = (await this.getRegistryEntry(BASE_REGISTRY_KEY_PATH, 'EnableAutoUpdater'));
        const entry = entries.pop();
        return entry ? entry === '0x1' : null;
    }

    /**
   * Initiates retrieval of a specific key in the Windows registry
   *
   * @param {string} key Path to the registry key to return
   * @param {string} name Name of specific entry in the registry key to retrieve (optional)
   */
    async getRegistryEntry(key: string, name?: string) {
        const results = [];
        for (const hive of REGISTRY_HIVE_LIST) {
            results.push(this.getRegistryEntryValues(hive, key, name));
        }
        const entryValues = await Promise.all(results);
        return entryValues.filter((value) => value);
    }

    /**
   * Handles actual retrieval of entries from a configured WindowsRegistry instance
   *
   * @param {WindowsRegistry} regKey A configured instance of the WindowsRegistry class
   * @param {string} name Name of the specific entry to retrieve (optional)
   */
    getRegistryEntryValues(hive: string, key: string, name?: string, utf8 = true) {
        return new Promise<string | WindowsRegistry.RegistryItem[] | undefined>((resolve, reject) => {
            try {
                const registry = this.createRegistry(hive, key, utf8);
                registry.values((error: Error, results: WindowsRegistry.RegistryItem[]) => {
                    if (error) {
                        this.handleRegistryEntryError(error, hive, key, name, utf8).then((result) => {
                            resolve(result);
                        });
                        return;
                    }
                    if (!results || results.length === 0) {
                        resolve(undefined);
                        return;
                    }
                    if (name) { // looking for a single entry value
                        const registryItem = results.find((item) => item.name === name);
                        resolve(registryItem && registryItem.value ? registryItem.value : undefined);
                    } else { // looking for an entry list
                        resolve(results);
                    }
                });
            } catch (e) {
                this.handleRegistryEntryError(e as Error, hive, key, name, utf8).then((result) => {
                    if (result) {
                        resolve(result);
                    }
                    reject(e);
                });
            }
        });
    }

    handleRegistryEntryError(e: Error, hive: string, key: string, name?: string, utf8?: boolean) {
        log.debug('There was an error accessing the registry for', {hive, key, name, utf8}, e);
        if (utf8) {
            log.debug('Trying without UTF-8...', {hive, key, name});
            return this.getRegistryEntryValues(hive, key, name, false);
        }

        return Promise.resolve(undefined);
    }

    createRegistry(hive: string, key: string, utf8 = true) {
        if (utf8) {
            return new WindowsRegistryUTF8({hive, key, utf8});
        }

        return new WindowsRegistry({hive, key});
    }
}
