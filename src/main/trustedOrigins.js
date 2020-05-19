// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import fs from 'fs';

import log from 'electron-log';

import Utils from '../utils/util.js';

import * as Validator from './Validator';

export default class TrustedOriginsStore {
  constructor(storeFile) {
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
  saveToFile(stringMap) {
    fs.writeFileSync(this.storeFile, stringMap);
  }

  save = () => {
    this.saveToFile(JSON.stringify(Object.fromEntries((this.data.entries())), null, '  '));
  };

  // if permissions or targetUrl are invalid, this function will throw an error
  // this function stablishes all the permissions at once, overwriting whatever was before
  // to enable just one permission use addPermission instead.
  set = (targetURL, permissions) => {
    const validPermissions = Validator.validateOriginPermissions(permissions);
    if (!validPermissions) {
      throw new Error(`Invalid permissions set for trusting ${targetURL}`);
    }
    this.data.set(Utils.getHost(targetURL), validPermissions);
  };

  // enables usage of `targetURL` for `permission`
  addPermission = (targetURL, permission) => {
    const origin = Utils.getHost(targetURL);
    const currentPermissions = this.data.get(origin) || {};
    currentPermissions[permission] = true;
    this.set(origin, currentPermissions);
  }

  delete = (targetURL) => {
    let host;
    try {
      host = Utils.getHost(targetURL);
      this.data.delete(host);
    } catch {
      return false;
    }
    return true;
  }

  isExisting = (targetURL) => {
    return (typeof this.data.get(Utils.getHost(targetURL)) !== 'undefined');
  };

  // if user hasn't set his preferences, it will return null (falsy)
  checkPermission = (targetURL, permission) => {
    if (!permission) {
      log.error(`Missing permission request on ${targetURL}`);
      return null;
    }
    let origin;
    try {
      origin = Utils.getHost(targetURL);
    } catch (e) {
      log.error(`invalid host to retrieve permissions: ${targetURL}: ${e}`);
      return null;
    }

    const urlPermissions = this.data.get(origin);
    return urlPermissions ? urlPermissions[permission] : null;
  }
}
