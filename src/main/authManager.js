// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';

import {BASIC_AUTH_PERMISSION} from 'common/permissions';
import urlUtils from 'common/utils/url';

import * as WindowManager from './windows/windowManager';

import {addModal} from './views/modalManager';
import {getLocalURLString, getLocalPreload} from './utils';

const modalPreload = getLocalPreload('modalPreload.js');
const loginModalHtml = getLocalURLString('loginModal.html');
const permissionModalHtml = getLocalURLString('permissionModal.html');

export class AuthManager {
    constructor(config, trustedOriginsStore) {
        this.config = config;
        this.trustedOriginsStore = trustedOriginsStore;
        this.loginCallbackMap = new Map();

        config.on('update', this.handleConfigUpdate);
    }

    handleConfigUpdate = (newConfig) => {
        this.config = newConfig;
    }

    handleAppLogin = (event, webContents, request, authInfo, callback) => {
        event.preventDefault();
        const parsedURL = new URL(request.url);
        const server = urlUtils.getServer(parsedURL, this.config.teams);

        this.loginCallbackMap.set(request.url, typeof callback === 'undefined' ? null : callback); // if callback is undefined set it to null instead so we know we have set it up with no value
        if (urlUtils.isTrustedURL(request.url, this.config.teams) || urlUtils.isCustomLoginURL(parsedURL, server, this.config.teams) || this.trustedOriginsStore.checkPermission(request.url, BASIC_AUTH_PERMISSION)) {
            this.popLoginModal(request, authInfo);
        } else {
            this.popPermissionModal(request, authInfo, BASIC_AUTH_PERMISSION);
        }
    }

    popLoginModal = (request, authInfo) => {
        const modalPromise = addModal(`login-${request.url}`, loginModalHtml, modalPreload, {request, authInfo}, WindowManager.getMainWindow());
        modalPromise.then((data) => {
            const {username, password} = data;
            this.handleLoginCredentialsEvent(request, username, password);
        }).catch((err) => {
            if (err) {
                log.error('Error processing login request', err);
            }
            this.handleCancelLoginEvent(request);
        });
    }

    popPermissionModal = (request, authInfo, permission) => {
        const modalPromise = addModal(`permission-${request.url}`, permissionModalHtml, modalPreload, {url: request.url, permission}, WindowManager.getMainWindow());
        modalPromise.then(() => {
            this.handlePermissionGranted(request.url, permission);
            this.addToLoginQueue(request, authInfo);
        }).catch((err) => {
            if (err) {
                log.error('Error processing permission request', err);
            }
            this.handleCancelLoginEvent(request);
        });
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
