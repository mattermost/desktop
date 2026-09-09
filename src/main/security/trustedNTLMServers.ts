// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {ipcMain} from 'electron';
import {EventEmitter} from 'events';

import {TRUSTED_NTLM_SERVERS_UPDATED, UPDATE_PATHS} from 'common/communication';
import {Logger} from 'common/log';

import {trustedNTLMServersStoreFile} from '../constants';

const log = new Logger('TrustedNTLMServers');

/**
 * Persists the set of external hostnames the user has explicitly allowed to
 * perform integrated (NTLM/Negotiate) authentication. These are domains that do
 * not belong to a configured Mattermost server, so they are blocked by default.
 */
export class TrustedNTLMServers extends EventEmitter {
    private storeFile: string;
    private hostnames: Set<string>;

    constructor(storeFile: string) {
        super();
        this.storeFile = storeFile;
        this.hostnames = new Set(this.readFromFile());
    }

    private readFromFile = (): string[] => {
        try {
            const data = JSON.parse(fs.readFileSync(this.storeFile, 'utf-8'));
            if (Array.isArray(data)) {
                return data.filter((item): item is string => typeof item === 'string');
            }
        } catch (e) {
            // No store yet or unreadable, start empty
        }
        return [];
    };

    private save = () => {
        try {
            fs.writeFileSync(this.storeFile, JSON.stringify([...this.hostnames], null, '  '));
        } catch (e) {
            log.error('Failed to persist trusted NTLM servers', e);
        }
    };

    isTrusted = (url: URL): boolean => {
        return this.hostnames.has(url.hostname);
    };

    add = (url: URL) => {
        if (this.hostnames.has(url.hostname)) {
            return;
        }
        this.hostnames.add(url.hostname);
        this.save();
        this.emit(TRUSTED_NTLM_SERVERS_UPDATED);
    };

    getHostnames = (): string[] => {
        return [...this.hostnames];
    };
}

let trustedNTLMServers = new TrustedNTLMServers(trustedNTLMServersStoreFile);
export default trustedNTLMServers;

ipcMain.on(UPDATE_PATHS, () => {
    log.debug('UPDATE_PATHS');
    trustedNTLMServers = new TrustedNTLMServers(trustedNTLMServersStoreFile);
});
