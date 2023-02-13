// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {AuthenticationResponseDetails, AuthInfo, WebContents} from 'electron';
import log from 'electron-log';

import {PermissionType} from 'types/trustedOrigin';
import {LoginModalData} from 'types/auth';

import {BASIC_AUTH_PERMISSION} from 'common/permissions';
import urlUtils from 'common/utils/url';

import modalManager from 'main/views/modalManager';
import TrustedOriginsStore from 'main/trustedOrigins';
import {getLocalURLString, getLocalPreload} from 'main/utils';
import WindowManager from 'main/windows/windowManager';

const preload = getLocalPreload('desktopAPI.js');
const loginModalHtml = getLocalURLString('loginModal.html');
const permissionModalHtml = getLocalURLString('permissionModal.html');

type LoginModalResult = {
    username: string;
    password: string;
};

export class AuthManager {
    loginCallbackMap: Map<string, ((username?: string, password?: string) => void) | undefined>;

    constructor() {
        this.loginCallbackMap = new Map();
    }

    handleAppLogin = (event: Event, webContents: WebContents, request: AuthenticationResponseDetails, authInfo: AuthInfo, callback?: (username?: string, password?: string) => void) => {
        log.verbose('AuthManager.handleAppLogin', {request, authInfo});

        event.preventDefault();
        const parsedURL = urlUtils.parseURL(request.url);
        if (!parsedURL) {
            return;
        }
        const serverURL = WindowManager.getServerURLFromWebContentsId(webContents.id);
        if (!serverURL) {
            return;
        }

        this.loginCallbackMap.set(request.url, callback); // if callback is undefined set it to null instead so we know we have set it up with no value
        if (urlUtils.isTrustedURL(request.url, serverURL) || urlUtils.isCustomLoginURL(parsedURL, serverURL) || TrustedOriginsStore.checkPermission(request.url, BASIC_AUTH_PERMISSION)) {
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
        const modalPromise = modalManager.addModal<LoginModalData, LoginModalResult>(authInfo.isProxy ? `proxy-${authInfo.host}` : `login-${request.url}`, loginModalHtml, preload, {request, authInfo}, mainWindow);
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
        const modalPromise = modalManager.addModal(`permission-${request.url}`, permissionModalHtml, preload, {url: request.url, permission}, mainWindow);
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
        TrustedOriginsStore.addPermission(url, permission);
        TrustedOriginsStore.save();
    }
}

const authManager = new AuthManager();
export default authManager;
