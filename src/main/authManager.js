// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';
import log from 'electron-log';

import {REQUEST_PERMISSION_CHANNEL, GRANT_PERMISSION_CHANNEL, DENY_PERMISSION_CHANNEL, BASIC_AUTH_PERMISSION} from 'common/permissions';
import urlUtils from 'common/utils/url';

import * as WindowManager from './windows/windowManager';

import {addModal} from './modalManager';
import {getLocalURLString} from './utils';

export class AuthManager {
  constructor(config, trustedOriginsStore) {
    this.config = config;
    this.trustedOriginsStore = trustedOriginsStore;
    this.loginQueue = [];
    this.loginCallbackMap = new Map();
  }

  handleAppLogin = (event, webContents, request, authInfo, callback) => {
    event.preventDefault();
    const parsedURL = new URL(request.url);
    const server = urlUtils.getServer(parsedURL, this.config.teams);

    this.loginCallbackMap.set(request.url, typeof callback === 'undefined' ? null : callback); // if callback is undefined set it to null instead so we know we have set it up with no value
    const mainWindow = WindowManager.getMainWindow(true);
    if (urlUtils.isTrustedURL(request.url, this.config.teams) || urlUtils.isCustomLoginURL(parsedURL, server, this.config.teams) || this.trustedOriginsStore.checkPermission(request.url, BASIC_AUTH_PERMISSION)) {
      this.addToLoginQueue(request, authInfo);
    } else {
      mainWindow.webContents.send(REQUEST_PERMISSION_CHANNEL, request, authInfo, BASIC_AUTH_PERMISSION);

      // pop permissionModal
    }
  }

  addToLoginQueue = (request, authInfo) => {
    this.loginQueue.push({
      request,
      authInfo,
    });

    this.showModalIfNecessary();
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

  showModalIfNecessary = () => {
    if (this.loginQueue.length) {
      const html = getLocalURLString('loginModal.html');

      //  const modalPreload = getLocalURLString('modalPreload.js');
      const modalPreload = path.resolve(__dirname, '../../dist/modalPreload.js');

      log.info('do the login modal thing!');

      // eslint-disable-next-line no-undefined
      const modalPromise = addModal('login', html, modalPreload, {request: this.loginQueue[0].request, authInfo: this.loginQueue[0].authInfo}, WindowManager.getMainWindow());
      if (modalPromise) {
        modalPromise.then((data) => {
          const {request, username, password} = data;
          this.handleLoginCredentialsEvent(request, username, password);
        }).catch((data) => {
          const {request} = data;
          this.handleCancelLoginEvent(request);
        });
      } else {
        console.warn('There is already a new server modal');
      }
    }
  }
}
