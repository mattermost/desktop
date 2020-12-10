// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';
import log from 'electron-log';

let registry;
try {
  // eslint-disable-next-line global-require
  registry = require('registry-js');
} catch (e) {
  if (process.platform === 'win32') {
    log.error(`couldn't import registry module: ${e}`);
  }
}

const REGISTRY_HIVE_LIST = registry ? [registry.HKEY.HKEY_LOCAL_MACHINE, registry.HKEY.HKEY_CURRENT_USER] : [];
const BASE_REGISTRY_KEY_PATH = 'Software\\Policies\\Mattermost';
export const REGISTRY_READ_EVENT = 'registry-read';

/**
 * Handles loading config data from the Windows registry set manually or by GPO
 */
export default class RegistryConfig extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.data = {
      teams: [],
    };
  }

  /**
   * Triggers loading data from Windows registry, supports async/await
   *
   * @emits {update} emitted once all data has been loaded from the registry
   */
  async init() {
    if (process.platform === 'win32' && registry) {
      // extract DefaultServerList from the registry
      try {
        const servers = await this.getServersListFromRegistry();
        if (servers.length) {
          this.data.teams.push(...servers);
        }
      } catch (error) {
        log.warn('[RegistryConfig] Nothing retrieved for \'DefaultServerList\'', error);
      }

      // extract EnableServerManagement from the registry
      try {
        const enableServerManagement = await this.getEnableServerManagementFromRegistry();
        if (enableServerManagement !== null) {
          this.data.enableServerManagement = enableServerManagement;
        }
      } catch (error) {
        log.warn('[RegistryConfig] Nothing retrieved for \'EnableServerManagement\'', error);
      }

      // extract EnableAutoUpdater from the registry
      try {
        const enableAutoUpdater = await this.getEnableAutoUpdatorFromRegistry();
        if (enableAutoUpdater !== null) {
          this.data.enableAutoUpdater = enableAutoUpdater;
        }
      } catch (error) {
        log.warn('[RegistryConfig] Nothing retrieved for \'EnableAutoUpdater\'', error);
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
    return defaultServers.flat(2).reduce((servers, server, index) => {
      if (server) {
        servers.push({
          name: server.name,
          url: server.data,
          order: server.order || index,
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
  async getRegistryEntry(key, name) {
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
  getRegistryEntryValues(hive, key, name) {
    return new Promise((resolve, reject) => {
      try {
        const results = registry.enumerateValues(hive, key);
        if (!results || results.length === 0) {
          resolve();
          return;
        }
        if (name) { // looking for a single entry value
          const registryItem = results.find((item) => item.name === name);
          resolve(registryItem && registryItem.value ? registryItem.value : null);
        } else { // looking for an entry list
          resolve(results);
        }
      } catch (e) {
        log.error(`There was an error accesing the registry for ${name}: ${e}`);
        reject(e);
      }
    });
  }
}
