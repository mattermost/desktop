// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import fs from 'fs';

import Utils from '../utils/util.js';
import {objectFromEntries} from '../utils/objects.js';

import * as Validator from './Validator';

export const BASIC_AUTH_PERMISSION = 'canBasicAuth';
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
    this.saveToFile(JSON.stringify(objectFromEntries((this.data.entries())), null, '  '));
  };

  // if permissions or targetUrl are invalid, this function will throw an error
  set = (targetURL, permissions) => {
    const validPermissions = Validator.validateOriginPermissions(permissions);
    if (!validPermissions) {
      throw new Error(`Invalid permissions set for trusting ${targetURL}`);
    }
    this.data.set(Utils.getHost(targetURL), validPermissions);
  };

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

  checkPermission = (targetURL, permission) => {
    let origin;
    try {
      origin = Utils.getHost(targetURL);
    } catch (e) {
      console.error(`invalid host to retrieve permissions: ${targetURL}: ${e}`);
      return false;
    }

    const urlPermissions = this.data.get(origin);
    if (!urlPermissions) {
      console.error(`can't check permissions on unknown site ${targetURL}, defaulting to false`);
      return false;
    }

    return urlPermissions[permission];
  }
}
