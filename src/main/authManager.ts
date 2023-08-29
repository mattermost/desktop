// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {AuthenticationResponseDetails, AuthInfo, WebContents, Event} from 'electron';

import {PermissionType} from 'types/trustedOrigin';
import {LoginModalData} from 'types/auth';

import {Logger} from 'common/log';
import {BASIC_AUTH_PERMISSION} from 'common/permissions';
import {isCustomLoginURL, isTrustedURL, parseURL} from 'common/utils/url';

import modalManager from 'main/views/modalManager';
import TrustedOriginsStore from 'main/trustedOrigins';
import {getLocalURLString, getLocalPreload} from 'main/utils';
import MainWindow from 'main/windows/mainWindow';
import ViewManager from 'main/views/viewManager';

const log = new Logger('AuthManager');
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
        log.verbose('handleAppLogin', {request, authInfo});

        event.preventDefault();
        const parsedURL = parseURL(request.url);
        if (!parsedURL) {
            return;
        }
        const serverURL = ViewManager.getViewByWebContentsId(webContents.id)?.view.server.url;
        if (!serverURL) {
            return;
        }

        this.loginCallbackMap.set(request.url, callback); // if callback is undefined set it to null instead so we know we have set it up with no value
        if (isTrustedURL(parsedURL, serverURL) || isCustomLoginURL(parsedURL, serverURL) || TrustedOriginsStore.checkPermission(parsedURL, BASIC_AUTH_PERMISSION)) {
            this.popLoginModal(request, authInfo);
        } else {
            this.popPermissionModal(request, authInfo, BASIC_AUTH_PERMISSION);
        }
    }

    popLoginModal = (request: AuthenticationResponseDetails, authInfo: AuthInfo) => {
        const mainWindow = MainWindow.get();
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
        const mainWindow = MainWindow.get();
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
        const parsedURL = parseURL(url);
        if (!parsedURL) {
            return;
        }
        TrustedOriginsStore.addPermission(parsedURL, permission);
        TrustedOriginsStore.save();
    }
}

const authManager = new AuthManager();
export default authManager;
