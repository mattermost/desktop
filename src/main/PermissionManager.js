const fs = require('fs');

const utils = require('../utils/util');

const PERMISSION_GRANTED = 'granted';
const PERMISSION_DENIED = 'denied';

class PermissionManager {
  constructor(file, trustedURLs = []) {
    this.file = file;
    this.setTrustedURLs(trustedURLs);
    if (fs.existsSync(file)) {
      try {
        this.permissions = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
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

module.exports = PermissionManager;
