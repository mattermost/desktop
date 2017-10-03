const {dialog} = require('electron');
const {URL} = require('url');
const fs = require('fs');

const PERMISSION_GRANTED = 'granted';
const PERMISSION_DENIED = 'denied';

class PermissionManager {
  constructor(file) {
    this.file = file;
    if (fs.existsSync(file)) {
      this.permissions = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
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
    return this.permissions[origin] && this.permissions[origin][permission] === PERMISSION_GRANTED;
  }

  isDenied(origin, permission) {
    return this.permissions[origin] && this.permissions[origin][permission] === PERMISSION_DENIED;
  }
}

function permissionRequestHandler(mainWindow, permissionFile) {
  const permissionManager = new PermissionManager(permissionFile);
  return (webContents, permission, callback) => {
    const targetURL = new URL(webContents.getURL());
    if (permissionManager.isDenied(targetURL.origin, permission)) {
      callback(false);
      return;
    }
    if (permissionManager.isGranted(targetURL.origin, permission)) {
      callback(true);
      return;
    }

    const buttons = ['Allow', 'Deny', 'Skip'];
    const result = dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons,
      title: 'Permission Required',
      message: `${targetURL.host} is requesting "${permission}" permission`,
      cancelId: 2,
      noLink: false
    });
    switch (result) {
    case buttons.indexOf('Allow'):
      permissionManager.grant(targetURL.origin, permission);
      callback(true);
      return;
    case buttons.indexOf('Deny'):
      permissionManager.deny(targetURL.origin, permission);
      callback(false);
      return;
    default:
      callback(false);
    }
  };
}

module.exports = permissionRequestHandler;
