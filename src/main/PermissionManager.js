// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';

import utils from '../utils/util';

import * as Validator from './Validator';

const PERMISSION_GRANTED = 'granted';
const PERMISSION_DENIED = 'denied';

export default class PermissionManager {
  constructor(file, trustedURLs = []) {
    this.file = file;
    this.setTrustedURLs(trustedURLs);
    if (fs.existsSync(file)) {
      try {
        this.permissions = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.permissions = Validator.validatePermissionsList(this.permissions);
        if (!this.permissions) {
          throw new Error('Provided permissions file does not validate, using defaults instead.');
        }
      } catch (err) {
        console.error(err);
        this.permissions = {};
      }
    } else {
      this.permissions = {};
    }
  }

  writeFileSync() {
    fs.writeFileSync(this.file, JSON.stringify(this.permissions, null, '  '));
  }

  grant(origin, permission) {
    if (!this.permissions[origin]) {
      this.permissions[origin] = {};
    }
    this.permissions[origin][permission] = PERMISSION_GRANTED;
    this.writeFileSync();
  }

  deny(origin, permission) {
    if (!this.permissions[origin]) {
      this.permissions[origin] = {};
    }
    this.permissions[origin][permission] = PERMISSION_DENIED;
    this.writeFileSync();
  }

  clear(origin, permission) {
    delete this.permissions[origin][permission];
  }

  isGranted(origin, permission) {
    if (this.trustedOrigins[origin] === true) {
      return true;
    }
    if (this.permissions[origin]) {
      return this.permissions[origin][permission] === PERMISSION_GRANTED;
    }
    return false;
  }

  isDenied(origin, permission) {
    if (this.permissions[origin]) {
      return this.permissions[origin][permission] === PERMISSION_DENIED;
    }
    return false;
  }

  setTrustedURLs(trustedURLs) {
    this.trustedOrigins = {};
    for (const url of trustedURLs) {
      const origin = utils.getDomain(url);
      this.trustedOrigins[origin] = true;
    }
  }
}
