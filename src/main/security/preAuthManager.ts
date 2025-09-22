// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type Certificate, type WebContents, type Event, app, type AuthenticationResponseDetails, type AuthInfo} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import {SERVER_REMOVED} from 'common/communication';
import {ModalConstants} from 'common/constants';
import {SECURE_STORAGE_KEYS} from 'common/constants/secureStorage';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {isTrustedURL as isTrustedURLHelper, parseURL} from 'common/utils/url';
import secureStorage from 'main/secureStorage';
import {getLocalPreload} from 'main/utils';

import type {LoginModalData} from 'types/auth';
import type {CertificateModalData} from 'types/certificate';

const log = new Logger('PreAuthManager');
const preload = getLocalPreload('internalAPI.js');
const loginModalHtml = 'mattermost-desktop://renderer/loginModal.html';
const preAuthModalHtml = 'mattermost-desktop://renderer/preAuthHeaderModal.html';
const html = 'mattermost-desktop://renderer/certificateModal.html';

export class PreAuthManager {
    constructor() {
        app.on('select-client-certificate', this.handleClientCert);
        app.on('login', this.handleBasicAuth);

        ServerManager.on(SERVER_REMOVED, this.handleServerRemoved);
    }

    preAuthHeaderOnHeadersReceivedHander = (
        details: Electron.OnHeadersReceivedListenerDetails,
        callback: (headersReceivedResponse: Electron.HeadersReceivedResponse) => void,
    ) => {
        if (details.responseHeaders?.['x-reject-reason']?.includes('pre-auth')) {
            const server = ServerManager.lookupServerByURL(details.url);
            if (server) {
                this.handlePreAuthSecret(server.url.toString(), async (secret) => {
                    if (secret) {
                        ServerManager.updatePreAuthSecret(server.id, secret);
                        await secureStorage.setSecret(server.url.toString(), SECURE_STORAGE_KEYS.PREAUTH, secret);
                        callback({cancel: true});
                        return;
                    }
                    callback({responseHeaders: details.responseHeaders});
                }, Boolean(server.preAuthSecret));

                return true;
            }
        }

        return false;
    };

    loadPreAuthSecretForServer = async (serverId: string) => {
        const server = ServerManager.getServer(serverId);
        if (!server) {
            return;
        }
        try {
            const secret = await secureStorage.getSecret(server.url.toString(), SECURE_STORAGE_KEYS.PREAUTH);
            if (secret) {
                ServerManager.updatePreAuthSecret(server.id, secret);
            }
        } catch (error) {
            log.warn('Failed to load pre-auth secret for server:', {serverId: server.id, error});
        }
    };

    private handlePreAuthSecret = (
        url: string,
        callback: (preAuthSecret?: string) => void,
        hasError: boolean,
    ) => {
        log.debug('handlePreAuthSecret');

        if (!this.isTrustedURL(url)) {
            log.info('URL is not trusted. Skipping pre auth secret');
            return;
        }

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }
        const modalKey = `${ModalConstants.PRE_AUTH_MODAL}-${url}`;
        const modalPromise = ModalManager.addModal<{url: string; hasError: boolean}, string>(
            modalKey, preAuthModalHtml, preload, {url, hasError}, mainWindow);
        if (modalPromise) {
            modalPromise.then((secret) => {
                callback(secret.trim());
            }).catch((err) => {
                log.error('Error processing login request', {err});
                callback();
            });
        }
    };

    private handleServerRemoved = (serverId: string) => {
        log.debug('handleServerRemoved', {serverId});

        const server = ServerManager.getServer(serverId);
        if (!server) {
            return;
        }

        // Clean up associated secret
        try {
            secureStorage.deleteSecret(server.url.toString(), SECURE_STORAGE_KEYS.PREAUTH);
        } catch (error) {
            log.warn('Failed to clean up secure secret for removed server:', {error});
        }
    };

    private handleClientCert = (
        event: Event,
        _: WebContents,
        url: string,
        list: Certificate[],
        callback: (certificate?: Certificate) => void,
    ) => {
        log.debug('handleClientCert');

        if (list.length <= 1) {
            log.info(`There were ${list.length} candidate certificates. Skipping certificate selection`);
            return;
        }

        event.preventDefault(); // prevent the app from getting the first certificate available

        // The URL provided is in the format <domain>:<port>, so we need to convert it to a proper URL for trust checking
        let urlToCheck = url;
        if (url.includes(':') && !url.includes('://')) {
            const [domain, port] = url.split(':');
            if (port === '443') {
                urlToCheck = `https://${domain}`;
            } else if (port === '80') {
                urlToCheck = `http://${domain}`;
            } else {
                urlToCheck = `https://${url}`;
            }
        }

        if (!this.isTrustedURL(urlToCheck)) {
            log.info('URL is not trusted. Skipping certificate selection');
            return;
        }

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            log.info('No main window found. Skipping certificate selection');
            return;
        }
        const modalPromise = ModalManager.addModal<CertificateModalData, {cert: Certificate}>(
            `${ModalConstants.CERTIFICATE_MODAL}-${url}`, html, preload, {url, list}, mainWindow,
        );
        if (modalPromise) {
            modalPromise.then((data) => {
                callback(data.cert);
            }).catch((err) => {
                log.error('Error processing certificate selection', {err});
                callback();
            });
        }
    };

    private handleBasicAuth = (
        event: Event,
        _: WebContents,
        request: AuthenticationResponseDetails,
        authInfo: AuthInfo,
        callback: (username?: string, password?: string) => void,
    ) => {
        log.debug('handleBasicAuth');
        event.preventDefault();

        if (!this.isTrustedURL(request.url)) {
            log.info('URL is not trusted. Skipping basic auth');
            return;
        }

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }
        const modalKey = authInfo.isProxy ? `${ModalConstants.PROXY_LOGIN_MODAL}-${authInfo.host}` : `${ModalConstants.LOGIN_MODAL}-${request.url}`;
        const modalPromise = ModalManager.addModal<LoginModalData, {username: string; password: string}>(
            modalKey, loginModalHtml, preload, {request, authInfo}, mainWindow);
        if (modalPromise) {
            modalPromise.then((data) => {
                const {username, password} = data;
                callback(username, password);
            }).catch((err) => {
                log.error('Error processing login request', {err});
                callback();
            });
        }
    };

    private isTrustedURL = (url: string): boolean => {
        const parsedURL = parseURL(url);
        if (!parsedURL) {
            return false;
        }

        const server = ServerManager.lookupServerByURL(parsedURL);
        return (server && isTrustedURLHelper(parsedURL, server.url)) || false;
    };
}

const preAuthManager = new PreAuthManager();
export default preAuthManager;
