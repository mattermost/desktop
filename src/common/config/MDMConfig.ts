// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPreferenceValue as getCFPreferenceValue, isPreferenceForced as isCFPreferenceForced} from 'cf-prefs';
import {EventEmitter} from 'events';

import {Logger} from 'common/log';

import type {RegistryConfig as RegistryConfigType, Server} from 'types/config';

const log = new Logger('MDMConfig');

const KEY_DEFAULT_SERVER_LIST = 'DefaultServerList';
const KEY_ENABLE_SERVER_MANAGEMENT = 'EnableServerManagement';
const KEY_ENABLE_AUTO_UPDATER = 'EnableAutoUpdater';

export const MDM_READ_EVENT = 'mdm-read';

function parseServerList(value: unknown): Server[] {
    if (!Array.isArray(value)) {
        return [];
    }
    log.info('Parsing server list', {value});
    return value.reduce((servers: Server[], entry) => {
        if (entry && typeof entry === 'object' && 'name' in entry) {
            const name = (entry as {name?: unknown}).name;
            const url = (entry as {url?: unknown}).url ?? (entry as {data?: unknown}).data;
            if (typeof name === 'string' && typeof url === 'string') {
                servers.push({name, url});
            }
        }
        return servers;
    }, []);
}

/**
 * Handles loading config data from macOS MDM managed preferences (CFPreferences)
 */
export default class MDMConfig extends EventEmitter {
    initialized: boolean;
    data: Partial<RegistryConfigType>;

    constructor() {
        super();
        this.initialized = false;
        this.data = {
            servers: [],
        };
    }

    init() {
        log.info('init');
        if (process.platform === 'darwin') {
            try {
                const serverListValue = getCFPreferenceValue(KEY_DEFAULT_SERVER_LIST);
                const servers = parseServerList(serverListValue);
                if (servers.length > 0) {
                    this.data.servers!.push(...servers);
                }
            } catch (error) {
                log.warn('Nothing retrieved for \'DefaultServerList\'', {error});
            }

            try {
                const value = getCFPreferenceValue(KEY_ENABLE_SERVER_MANAGEMENT);
                this.data.enableServerManagement = value === true;
            } catch (error) {
                log.warn('Nothing retrieved for \'EnableServerManagement\'', {error});
                this.data.enableServerManagement = false;
            }

            try {
                const value = getCFPreferenceValue(KEY_ENABLE_AUTO_UPDATER);
                this.data.enableUpdateNotifications = value === true;
            } catch (error) {
                log.warn('Nothing retrieved for \'EnableAutoUpdater\'', {error});
                this.data.enableUpdateNotifications = false;
            }
        }

        this.initialized = true;
        this.emit(MDM_READ_EVENT, this.data);
    }

    isPreferenceForced(key: string): boolean {
        if (process.platform !== 'darwin') {
            return false;
        }
        try {
            return isCFPreferenceForced(key);
        } catch {
            return false;
        }
    }
}
