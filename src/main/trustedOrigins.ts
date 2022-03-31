// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import fs from 'fs';

import {ipcMain} from 'electron';
import log from 'electron-log';

import {TrustedOrigin, PermissionType} from 'types/trustedOrigin';

import {UPDATE_PATHS} from 'common/communication';
import urlUtils from 'common/utils/url';

import * as Validator from './Validator';
import {trustedOriginsStoreFile} from './constants';

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
    }

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
    }

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
    set = (targetURL: string, permissions: Record<PermissionType, boolean>) => {
        if (!this.data) {
            return;
        }
        const validPermissions = Validator.validateOriginPermissions(permissions);
        if (!validPermissions) {
            throw new Error(`Invalid permissions set for trusting ${targetURL}`);
        }
        this.data.set(urlUtils.getHost(targetURL), validPermissions);
    };

    // enables usage of `targetURL` for `permission`
    addPermission = (targetURL: string, permission: PermissionType) => {
        const origin = urlUtils.getHost(targetURL);
        this.set(origin, {[permission]: true});
    }

    delete = (targetURL: string) => {
        let host;
        try {
            host = urlUtils.getHost(targetURL);
            this.data?.delete(host);
        } catch {
            return false;
        }
        return true;
    }

    isExisting = (targetURL: string) => {
        return this.data?.has(urlUtils.getHost(targetURL)) || false;
    };

    // if user hasn't set his preferences, it will return null (falsy)
    checkPermission = (targetURL: string, permission: PermissionType) => {
        if (!permission) {
            log.error(`Missing permission request on ${targetURL}`);
            return null;
        }
        let origin;
        try {
            origin = urlUtils.getHost(targetURL);
        } catch (e) {
            log.error(`invalid host to retrieve permissions: ${targetURL}: ${e}`);
            return null;
        }

        const urlPermissions = this.data?.get(origin);
        return urlPermissions ? urlPermissions[permission] : undefined;
    }
}

const trustedOriginsStore = new TrustedOriginsStore(trustedOriginsStoreFile);
export default trustedOriginsStore;

ipcMain.on(UPDATE_PATHS, () => {
    log.debug('trustedOriginsStore.UPDATE_PATHS');
    trustedOriginsStore.storeFile = trustedOriginsStoreFile;
    if (trustedOriginsStore.data) {
        trustedOriginsStore.load();
    }
});
