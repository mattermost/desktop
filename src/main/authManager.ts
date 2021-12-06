// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {AuthenticationResponseDetails, AuthInfo, WebContents} from 'electron';
import log from 'electron-log';

import {CombinedConfig} from 'types/config';
import {PermissionType} from 'types/trustedOrigin';
import {LoginModalData} from 'types/auth';

import {BASIC_AUTH_PERMISSION} from 'common/permissions';
import urlUtils from 'common/utils/url';

import WindowManager from 'main/windows/windowManager';
import modalManager from './views/modalManager';
import {getLocalURLString, getLocalPreload} from 'main/utils';

import TrustedOriginsStore from './trustedOrigins';

const modalPreload = getLocalPreload('modalPreload.js');
const loginModalHtml = getLocalURLString('loginModal.html');
const permissionModalHtml = getLocalURLString('permissionModal.html');

type LoginModalResult = {
    username: string;
    password: string;
};

export class AuthManager {
    config: CombinedConfig;
    trustedOriginsStore: TrustedOriginsStore;
    loginCallbackMap: Map<string, ((username?: string, password?: string) => void) | undefined>;

    constructor(config: CombinedConfig, trustedOriginsStore: TrustedOriginsStore) {
        this.config = config;
        this.trustedOriginsStore = trustedOriginsStore;
        this.loginCallbackMap = new Map();
    }

    handleConfigUpdate = (newConfig: CombinedConfig) => {
        this.config = newConfig;
    }

    handleAppLogin = (event: Event, webContents: WebContents, request: AuthenticationResponseDetails, authInfo: AuthInfo, callback?: (username?: string, password?: string) => void) => {
        event.preventDefault();
        const parsedURL = urlUtils.parseURL(request.url);
        if (!parsedURL) {
            return;
        }
        const server = urlUtils.getView(parsedURL, this.config.teams);
        if (!server) {
            return;
        }

        this.loginCallbackMap.set(request.url, callback); // if callback is undefined set it to null instead so we know we have set it up with no value
        if (urlUtils.isTrustedURL(request.url, this.config.teams) || urlUtils.isCustomLoginURL(parsedURL, server, this.config.teams) || this.trustedOriginsStore.checkPermission(request.url, BASIC_AUTH_PERMISSION)) {
            this.popLoginModal(request, authInfo);
        } else {
            this.popPermissionModal(request, authInfo, BASIC_AUTH_PERMISSION);
        }
    }

    popLoginModal = (request: AuthenticationResponseDetails, authInfo: AuthInfo) => {
        const mainWindow = WindowManager.getMainWindow();
        if (!mainWindow) {
            return;
        }
        const modalPromise = modalManager.addModal<LoginModalData, LoginModalResult>(authInfo.isProxy ? `proxy-${authInfo.host}` : `login-${request.url}`, loginModalHtml, modalPreload, {request, authInfo}, mainWindow);
        if (modalPromise) {
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
    }

    popPermissionModal = (request: AuthenticationResponseDetails, authInfo: AuthInfo, permission: PermissionType) => {
        const mainWindow = WindowManager.getMainWindow();
        if (!mainWindow) {
            return;
        }
        const modalPromise = modalManager.addModal(`permission-${request.url}`, permissionModalHtml, modalPreload, {url: request.url, permission}, mainWindow);
        if (modalPromise) {
            modalPromise.then(() => {
                this.handlePermissionGranted(request.url, permission);
                this.popLoginModal(request, authInfo);
            }).catch((err) => {
                if (err) {
                    log.error('Error processing permission request', err);
                }
                this.handleCancelLoginEvent(request);
            });
        }
    }

    handleLoginCredentialsEvent = (request: AuthenticationResponseDetails, username?: string, password?: string) => {
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

    handleCancelLoginEvent = (request: AuthenticationResponseDetails) => {
        log.info(`Cancelling request for ${request ? request.url : 'unknown'}`);
        this.handleLoginCredentialsEvent(request); // we use undefined to cancel the request
    }

    handlePermissionGranted(url: string, permission: PermissionType) {
        this.trustedOriginsStore.addPermission(url, permission);
        this.trustedOriginsStore.save();
    }
}
