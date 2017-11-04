const {ipcMain} = require('electron');
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
}

function dequeueRequests(requestQueue, permissionManager, origin, permission, status) {
  switch (status) {
  case 'allow':
    permissionManager.grant(origin, permission);
    break;
  case 'block':
    permissionManager.deny(origin, permission);
    break;
  default:
    break;
  }
  if (status === 'allow' || status === 'block') {
    const newQueue = requestQueue.filter((request) => {
      if (request.origin === origin && request.permission === permission) {
        request.callback(status === 'allow');
        return false;
      }
      return true;
    });
    requestQueue.splice(0, requestQueue.length, ...newQueue);
  } else {
    const index = requestQueue.findIndex((request) => {
      return request.origin === origin && request.permission === permission;
    });
    requestQueue[index].callback(false);
    requestQueue.splice(index, 1);
  }
}

function permissionRequestHandler(mainWindow, permissionFile) {
  const permissionManager = new PermissionManager(permissionFile);
  const requestQueue = [];
  ipcMain.on('update-permission', (event, origin, permission, status) => {
    dequeueRequests(requestQueue, permissionManager, origin, permission, status);
  });
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

    requestQueue.push({
      origin: targetURL.origin,
      permission,
      callback
    });
    mainWindow.webContents.send('request-permission', targetURL.origin, permission);
  };
}

permissionRequestHandler.PermissionManager = PermissionManager;

module.exports = permissionRequestHandler;
