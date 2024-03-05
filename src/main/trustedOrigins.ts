// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import fs from 'fs';

import {ipcMain} from 'electron';

import {UPDATE_PATHS} from 'common/communication';
import {Logger} from 'common/log';
import * as Validator from 'common/Validator';

import type {TrustedOrigin, PermissionType} from 'types/trustedOrigin';

import {trustedOriginsStoreFile} from './constants';

const log = new Logger('TrustedOriginsStore');

export class TrustedOriginsStore {
    storeFile: string;
    data?: Map<string, TrustedOrigin>;

    constructor(storeFile: string) {
        this.storeFile = storeFile;
    }

    // don't use this, is for ease of mocking it on testing
    readFromFile = () => {
        let storeData;
        try {
            storeData = fs.readFileSync(this.storeFile, 'utf-8');
        } catch (e) {
            storeData = null;
        }
        return storeData;
    };

    load = () => {
        const storeData = this.readFromFile();
        let result = {};
        if (storeData !== null) {
            result = Validator.validateTrustedOriginsStore(storeData);
            if (!result) {
                throw new Error('Provided TrustedOrigins file does not validate, using defaults instead.');
            }
        }
        this.data = new Map(Object.entries(result));
    };

    // don't use this, is for ease of mocking it on testing
    saveToFile(stringMap: string) {
        fs.writeFileSync(this.storeFile, stringMap);
    }

    save = () => {
        if (!this.data) {
            return;
        }
        this.saveToFile(JSON.stringify(Object.fromEntries((this.data.entries())), null, '  '));
    };

    // if permissions or targetUrl are invalid, this function will throw an error
    // this function stablishes all the permissions at once, overwriting whatever was before
    // to enable just one permission use addPermission instead.
    set = (targetURL: URL, permissions: Record<PermissionType, boolean>) => {
        if (!this.data) {
            return;
        }
        const validPermissions = Validator.validateOriginPermissions(permissions);
        if (!validPermissions) {
            throw new Error(`Invalid permissions set for trusting ${targetURL}`);
        }
        this.data.set(targetURL.origin, validPermissions);
    };

    // enables usage of `targetURL` for `permission`
    addPermission = (targetURL: URL, permission: PermissionType) => {
        this.set(targetURL, {[permission]: true});
    };

    delete = (targetURL: URL) => {
        return this.data?.delete(targetURL.origin);
    };

    isExisting = (targetURL: URL) => {
        return this.data?.has(targetURL.origin) || false;
    };

    checkPermission = (targetURL: URL, permission: PermissionType) => {
        if (!permission) {
            log.error(`Missing permission request on ${targetURL}`);
            return null;
        }

        const urlPermissions = this.data?.get(targetURL.origin);
        return urlPermissions ? urlPermissions[permission] : undefined;
    };
}

const trustedOriginsStore = new TrustedOriginsStore(trustedOriginsStoreFile);
export default trustedOriginsStore;

ipcMain.on(UPDATE_PATHS, () => {
    log.debug('UPDATE_PATHS');
    trustedOriginsStore.storeFile = trustedOriginsStoreFile;
    if (trustedOriginsStore.data) {
        trustedOriginsStore.load();
    }
});
