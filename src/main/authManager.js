// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';
import log from 'electron-log';

import {BASIC_AUTH_PERMISSION} from 'common/permissions';
import urlUtils from 'common/utils/url';

import * as WindowManager from './windows/windowManager';

import {addModal} from './modalManager';
import {getLocalURLString} from './utils';

const modalPreload = path.resolve(__dirname, '../../dist/modalPreload.js');
export class AuthManager {
  constructor(config, trustedOriginsStore) {
    this.config = config;
    this.trustedOriginsStore = trustedOriginsStore;
    this.loginQueue = [];
    this.permissionQueue = [];
    this.loginCallbackMap = new Map();
  }

  handleAppLogin = (event, webContents, request, authInfo, callback) => {
    event.preventDefault();
    const parsedURL = new URL(request.url);
    const server = urlUtils.getServer(parsedURL, this.config.teams);

    this.loginCallbackMap.set(request.url, typeof callback === 'undefined' ? null : callback); // if callback is undefined set it to null instead so we know we have set it up with no value
    if (urlUtils.isTrustedURL(request.url, this.config.teams) || urlUtils.isCustomLoginURL(parsedURL, server, this.config.teams) || this.trustedOriginsStore.checkPermission(request.url, BASIC_AUTH_PERMISSION)) {
      this.addToLoginQueue(request, authInfo);
    } else {
      this.addToPermissionQueue(request, authInfo, BASIC_AUTH_PERMISSION);
    }
  }

  addToPermissionQueue = (request, authInfo, permission) => {
    this.permissionQueue.push({
      request,
      authInfo,
      permission,
    });

    this.showPermissionModalIfNecessary();
  }

  addToLoginQueue = (request, authInfo) => {
    this.loginQueue.push({
      request,
      authInfo,
    });

    this.showLoginModalIfNecessary();
  }

  showLoginModalIfNecessary = () => {
    if (this.loginQueue.length) {
      const html = getLocalURLString('loginModal.html');

      const modalPromise = addModal('login', html, modalPreload, {request: this.loginQueue[0].request, authInfo: this.loginQueue[0].authInfo}, WindowManager.getMainWindow());
      if (modalPromise) {
        modalPromise.then((data) => {
          const {request, username, password} = data;
          this.handleLoginCredentialsEvent(request, username, password);
          this.loginQueue.shift();
          this.showLoginModalIfNecessary();
        }).catch((data) => {
          const {request} = data;
          this.handleCancelLoginEvent(request);
          this.loginQueue.shift();
          this.showLoginModalIfNecessary();
        });
      } else {
        console.warn('There is already a login modal');
      }
    }
  }

  showPermissionModalIfNecessary = () => {
    if (this.permissionQueue.length) {
      const html = getLocalURLString('permissionModal.html');

      const {request, authInfo, permission} = this.permissionQueue[0];
      const modalPromise = addModal('permission', html, modalPreload, {url: request.url, permission}, WindowManager.getMainWindow());
      if (modalPromise) {
        modalPromise.then(() => {
          this.handlePermissionGranted(request.url, permission);
          this.addToLoginQueue(request, authInfo);
          this.permissionQueue.shift();
          this.showPermissionModalIfNecessary();
        }).catch((err) => {
          log.warn(`Permission request denied: ${err.message}`);
          this.handleCancelLoginEvent(request);
          this.permissionQueue.shift();
          this.showPermissionModalIfNecessary();
        });
      } else {
        console.warn('There is already a permission modal');
      }
    }
  }

  handleLoginCredentialsEvent = (request, username, password) => {
    const callback = this.loginCallbackMap.get(request.url);
    if (typeof callback === 'undefined') {
      log.error(`Failed to retrieve login callback for ${request.url}`);
      return;
    }
    if (callback != null) {
      callback(username, password);
    }
    this.loginCallbackMap.delete(request.url);
  }

  handleCancelLoginEvent = (request) => {
    log.info(`Cancelling request for ${request ? request.url : 'unknown'}`);
    this.handleLoginCredentialsEvent(request); // we use undefined to cancel the request
  }

  handlePermissionGranted(url, permission) {
    this.trustedOriginsStore.addPermission(url, permission);
    this.trustedOriginsStore.save();
  }
}
