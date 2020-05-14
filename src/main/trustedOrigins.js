// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import fs from 'fs';

import * as Validator from './Validator';
import getHost from './utils';

export default class TrustedOriginsStore {
  constructor(storeFile) {
    this.storeFile = storeFile;
  }

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
    this.data = result;
  }

  save = () => {
    fs.writeFileSync(this.storeFile, JSON.stringify(this.data, null, '  '));
  };

  // if permissions or targetUrl are invalid, this function will throw an error
  set = (targetURL, permissions) => {
    const validPermissions = Validator.validateOriginPermissions(permissions);
    if (!validPermissions) {
      throw new Error(`Invalid permissions set for trusting ${targetURL}`);
    }
    this.data[getHost(targetURL)] = validPermissions;
  };

  remove = (targetURL) => {
    let host;
    try {
      host = getHost(targetURL);
      delete this.data[host];
    } catch {
      return false;
    }
    return true;
  }

  isExisting = (targetURL) => {
    return Boolean(this.data[getHost(targetURL)]);
  };

  checkPermission = (targetURL, permission) => {
    let origin;
    try {
      origin = getHost(targetURL);
    } catch {
      return false;
    }

    const urlPermissions = this.data[origin];
    if (!urlPermissions) {
      return false;
    }

    return urlPermissions[permission];
  }
}
