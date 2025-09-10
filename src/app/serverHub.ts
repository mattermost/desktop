// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent} from 'electron';
import {ipcMain} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import {
    GET_ORDERED_SERVERS,
    SHOW_EDIT_SERVER_MODAL,
    SHOW_NEW_SERVER_MODAL,
    SHOW_REMOVE_SERVER_MODAL,
    TOGGLE_SECURE_INPUT,
    UPDATE_SERVER_ORDER,
    UPDATE_SHORTCUT_MENU,
    VALIDATE_SERVER_URL,
    GET_UNIQUE_SERVERS_WITH_PERMISSIONS,
    ADD_SERVER,
    EDIT_SERVER,
    REMOVE_SERVER,
    GET_LAST_ACTIVE,
    SERVER_SWITCHED,
    GET_CURRENT_SERVER,
} from 'common/communication';
import {ModalConstants} from 'common/constants';
import {SECURE_STORAGE_KEYS} from 'common/constants/secureStorage';
import {Logger} from 'common/log';
import {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {URLValidationStatus} from 'common/utils/constants';
import {isValidURI, isValidURL, parseURL} from 'common/utils/url';
import {savePreAuthSecret, saveOrDeletePreAuthSecret, extractPreAuthSecret} from 'main/preAuthSecret';
import secureStorage from 'main/secureStorage';
import PermissionsManager from 'main/security/permissionsManager';
import {ServerInfo} from 'main/server/serverInfo';
import {getLocalPreload} from 'main/utils';

import type {Server, UniqueServer, NewServer} from 'types/config';
import type {Permissions, UniqueServerWithPermissions} from 'types/permissions';
import type {ServerTestResult, URLValidationResult} from 'types/server';

const log = new Logger('App', 'ServerHub');

export class ServerHub {
    constructor() {
        ipcMain.on(SHOW_NEW_SERVER_MODAL, this.handleShowNewServerModal);
        ipcMain.on(SHOW_EDIT_SERVER_MODAL, this.showEditServerModal);
        ipcMain.on(SHOW_REMOVE_SERVER_MODAL, this.showRemoveServerModal);

        ipcMain.handle(VALIDATE_SERVER_URL, this.handleServerURLValidation);
        ipcMain.handle(GET_ORDERED_SERVERS, this.handleGetOrderedServers);
        ipcMain.on(UPDATE_SERVER_ORDER, this.updateServerOrder);
        ipcMain.handle(GET_LAST_ACTIVE, this.handleGetLastActive);
        ipcMain.handle(GET_UNIQUE_SERVERS_WITH_PERMISSIONS, this.getUniqueServersWithPermissions);
        ipcMain.on(ADD_SERVER, this.handleAddServer);
        ipcMain.on(EDIT_SERVER, this.handleEditServer);
        ipcMain.on(REMOVE_SERVER, this.handleRemoveServer);
        ipcMain.handle(GET_CURRENT_SERVER, this.handleGetCurrentServer);

        ServerManager.on(SERVER_SWITCHED, this.handleServerCurrentChanged);
    }

    // TODO: Move me somewhere else later
    handleServerCurrentChanged = () => {
        ipcMain.emit(TOGGLE_SECURE_INPUT, null, false);
        ipcMain.emit(UPDATE_SHORTCUT_MENU);
    };

    private handleGetCurrentServer = () => {
        const serverId = ServerManager.getCurrentServerId();
        if (!serverId) {
            return {server: undefined, view: undefined};
        }
        const server = ServerManager.getServer(serverId);
        if (!server) {
            return {server: undefined, view: undefined};
        }
        return server.toUniqueServer();
    };

    /**
     * Server Modals
     */

    showNewServerModal = (prefillURL?: string) => {
        log.debug('showNewServerModal', {prefillURL});

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        const modalPromise = ModalManager.addModal<{prefillURL?: string}, NewServer>(
            ModalConstants.NEW_SERVER_MODAL,
            'mattermost-desktop://renderer/newServer.html',
            getLocalPreload('internalAPI.js'),
            {prefillURL},
            mainWindow,
            !ServerManager.hasServers(),
        );

        modalPromise.then(async (data) => {
            let initialLoadURL;
            if (prefillURL) {
                const parsedServerURL = parseURL(data.url);
                if (parsedServerURL) {
                    initialLoadURL = parseURL(`${parsedServerURL.origin}${prefillURL.substring(prefillURL.indexOf('/'))}`);
                }
            }
            const newServer = ServerManager.addServer(data, initialLoadURL);

            // Handle secure storage persistence separately
            await savePreAuthSecret(data, newServer.url.toString());
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the new server modal: ${e}`);
            }
        });
    };

    private handleShowNewServerModal = () => this.showNewServerModal();

    private showEditServerModal = (e: IpcMainEvent, id: string) => {
        log.debug('showEditServerModal', id);

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }
        const server = ServerManager.getServer(id);
        if (!server) {
            return;
        }

        const modalPromise = ModalManager.addModal<UniqueServerWithPermissions, {server: NewServer; permissions: Permissions}>(
            ModalConstants.EDIT_SERVER_MODAL,
            'mattermost-desktop://renderer/editServer.html',
            getLocalPreload('internalAPI.js'),
            {server: server.toUniqueServer(), permissions: PermissionsManager.getForServer(server) ?? {}},
            mainWindow);

        modalPromise.then(async (data) => {
            if (!server.isPredefined) {
                ServerManager.editServer(id, data.server, extractPreAuthSecret(data.server));

                // Handle secure storage persistence separately
                await saveOrDeletePreAuthSecret(data.server, server.url.toString());
            }
            PermissionsManager.setForServer(server, data.permissions);
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the edit server modal: ${e}`);
            }
        });
    };

    private showRemoveServerModal = (e: IpcMainEvent, id: string) => {
        log.debug('handleRemoveServerModal', id);

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }
        const server = ServerManager.getServer(id);
        if (!server) {
            return;
        }

        const modalPromise = ModalManager.addModal<null, boolean>(
            ModalConstants.REMOVE_SERVER_MODAL,
            'mattermost-desktop://renderer/removeServer.html',
            getLocalPreload('internalAPI.js'),
            null,
            mainWindow,
        );

        modalPromise.then(async (remove) => {
            if (remove) {
                ServerManager.removeServer(server.id);

                // Clean up associated secret
                try {
                    await secureStorage.deleteSecret(server.url.toString(), SECURE_STORAGE_KEYS.PREAUTH);
                } catch (error) {
                    log.warn('Failed to clean up secure secret for removed server:', error);
                }
            }
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the edit server modal: ${e}`);
            }
        });
    };

    /**
     * IPC Handlers
     */

    private handleServerURLValidation = async (e: IpcMainInvokeEvent, url?: string, currentId?: string, preAuthSecret?: string): Promise<URLValidationResult> => {
        log.debug('handleServerURLValidation', url, currentId);

        // If the URL is missing or null, reject
        if (!url) {
            return {status: URLValidationStatus.Missing};
        }

        let httpUrl = url;
        if (!isValidURL(url)) {
            // If it already includes the protocol, force it to HTTPS
            if (isValidURI(url) && !url.toLowerCase().startsWith('http')) {
                httpUrl = url.replace(/^((.+):\/\/)?/, 'https://');
            } else if (!'https://'.startsWith(url.toLowerCase()) && !'http://'.startsWith(url.toLowerCase())) {
                // Check if they're starting to type `http(s)`, otherwise add HTTPS for them
                httpUrl = `https://${url}`;
            }
        }

        // Make sure the final URL is valid
        const parsedURL = parseURL(httpUrl);
        if (!parsedURL) {
            return {status: URLValidationStatus.Invalid};
        }

        // Try and add HTTPS to see if we can get a more secure URL
        let secureURL = parsedURL;
        if (parsedURL.protocol === 'http:') {
            secureURL = parseURL(parsedURL.toString().replace(/^http:/, 'https:')) ?? parsedURL;
        }

        // Tell the user if they already have a server for this URL
        const existingServer = ServerManager.lookupServerByURL(secureURL, true);
        if (existingServer && existingServer.id !== currentId) {
            return {status: URLValidationStatus.URLExists, existingServerName: existingServer.name, validatedURL: existingServer.url.toString()};
        }

        const effectivePreAuthSecret = preAuthSecret;

        // Try and get remote info from the most secure URL, otherwise use the insecure one
        let remoteURL = secureURL;
        const insecureURL = parseURL(secureURL.toString().replace(/^https:/, 'http:'));
        let remoteInfo;
        let preAuthRequired = false;

        const httpsResult = await this.testRemoteServer(secureURL, effectivePreAuthSecret);
        if ('data' in httpsResult) {
            remoteInfo = httpsResult.data;
        } else {
            // Check if HTTPS returned 403
            const httpsIs403 = httpsResult.error?.statusCode === 403;

            if (insecureURL) {
                // Try to fall back to HTTP
                const httpResult = await this.testRemoteServer(insecureURL, effectivePreAuthSecret);
                if ('data' in httpResult) {
                    remoteInfo = httpResult.data;
                    remoteURL = insecureURL;
                } else {
                    // Both HTTPS and HTTP failed
                    const httpIs403 = httpResult.error?.statusCode === 403;
                    if (httpsIs403 || httpIs403) {
                        preAuthRequired = true;

                        // Use the URL that returned 403, preferring HTTPS
                        remoteURL = httpsIs403 ? secureURL : insecureURL;
                    }
                }
            } else if (httpsIs403) {
                // No HTTP fallback available, but HTTPS returned 403
                preAuthRequired = true;
            }
        }

        // If we detected a 403 error, return PreAuthRequired status
        if (preAuthRequired) {
            return {status: URLValidationStatus.PreAuthRequired, validatedURL: remoteURL.toString().replace(/\/$/, '')};
        }

        // If we can't get the remote info, warn the user that this might not be the right URL
        // If the original URL was invalid, don't replace that as they probably have a typo somewhere
        // Also strip the trailing slash if it's there so that the user can keep typing
        if (!remoteInfo) {
            // If the URL provided has a path, try to validate the server with parts of the path removed, until we reach the root and then return a failure
            if (parsedURL.pathname !== '/') {
                return this.handleServerURLValidation(e, parsedURL.toString().substring(0, parsedURL.toString().lastIndexOf('/')), currentId, effectivePreAuthSecret);
            }

            return {status: URLValidationStatus.NotMattermost, validatedURL: parsedURL.toString().replace(/\/$/, '')};
        }

        const remoteServerName = remoteInfo.siteName === 'Mattermost' ? remoteURL.host.split('.')[0] : remoteInfo.siteName;

        // If we were only able to connect via HTTP, warn the user that the connection is not secure
        if (remoteURL.protocol === 'http:') {
            return {status: URLValidationStatus.Insecure, serverVersion: remoteInfo.serverVersion, serverName: remoteServerName, validatedURL: remoteURL.toString()};
        }

        // If the URL doesn't match the Site URL, set the URL to the correct one
        if (remoteInfo.siteURL && remoteURL.toString() !== new URL(remoteInfo.siteURL).toString()) {
            const parsedSiteURL = parseURL(remoteInfo.siteURL);
            if (parsedSiteURL) {
                // Check the Site URL as well to see if it's already pre-configured
                const existingServer = ServerManager.lookupServerByURL(parsedSiteURL, true);
                if (existingServer && existingServer.id !== currentId) {
                    return {status: URLValidationStatus.URLExists, existingServerName: existingServer.name, validatedURL: existingServer.url.toString()};
                }

                // If we can't reach the remote Site URL, there's probably a configuration issue
                const remoteSiteURLResult = await this.testRemoteServer(parsedSiteURL, effectivePreAuthSecret);
                if ('error' in remoteSiteURLResult) {
                    return {status: URLValidationStatus.URLNotMatched, serverVersion: remoteInfo.serverVersion, serverName: remoteServerName, validatedURL: remoteURL.toString()};
                }
            }

            // Otherwise fix it for them and return
            return {status: URLValidationStatus.URLUpdated, serverVersion: remoteInfo.serverVersion, serverName: remoteServerName, validatedURL: remoteInfo.siteURL};
        }

        return {status: URLValidationStatus.OK, serverVersion: remoteInfo.serverVersion, serverName: remoteServerName, validatedURL: remoteURL.toString()};
    };

    private handleGetOrderedServers = () => ServerManager.getOrderedServers().map((srv) => srv.toUniqueServer());

    /**
     * Helper functions
     */

    private testRemoteServer = async (parsedURL: URL, preAuthSecret?: string): Promise<ServerTestResult> => {
        const server = new MattermostServer({name: 'temp', url: parsedURL.toString()}, false, undefined, preAuthSecret);
        const serverInfo = new ServerInfo(server, preAuthSecret);
        try {
            const remoteInfo = await serverInfo.fetchConfigData();
            return {data: remoteInfo};
        } catch (error) {
            return {error: error as Error & { statusCode?: number }};
        }
    };

    private getUniqueServersWithPermissions = () => {
        return ServerManager.getAllServers().
            map((server) => ({
                server: server.toUniqueServer(),
                permissions: PermissionsManager.getForServer(server) ?? {},
            }));
    };

    private handleAddServer = async (event: IpcMainEvent, server: Server & {preAuthSecret?: string}) => {
        log.debug('handleAddServer', server);

        const newServer = ServerManager.addServer(server);

        // Handle secure storage persistence separately
        await savePreAuthSecret(server, newServer.url.toString());
    };

    private handleEditServer = async (event: IpcMainEvent, server: UniqueServer, permissions?: Permissions) => {
        log.debug('handleEditServer', server, permissions);

        if (!server.id) {
            return;
        }

        if (!server.isPredefined) {
            ServerManager.editServer(server.id, server, extractPreAuthSecret(server));

            // Handle secure storage persistence separately
            await saveOrDeletePreAuthSecret(server, server.url);
        }
        if (permissions) {
            const mattermostServer = ServerManager.getServer(server.id);
            if (mattermostServer) {
                PermissionsManager.setForServer(mattermostServer, permissions);
            }
        }
    };

    private handleRemoveServer = async (event: IpcMainEvent, serverId: string) => {
        log.debug('handleRemoveServer', serverId);

        const server = ServerManager.getServer(serverId);
        if (!server) {
            return;
        }

        // Remove the server from ServerManager
        ServerManager.removeServer(serverId);

        // Clean up associated secret
        try {
            await secureStorage.deleteSecret(server.url.toString(), SECURE_STORAGE_KEYS.PREAUTH);
        } catch (error) {
            log.warn('Failed to clean up secure secret for removed server:', error);
        }
    };

    private handleGetLastActive = () => {
        const serverId = ServerManager.getCurrentServerId();
        if (!serverId) {
            return {server: undefined, view: undefined};
        }
        const server = ServerManager.getServer(serverId);
        if (!server) {
            return {server: undefined, view: undefined};
        }
        return {server: server.id, view: server.id};
    };
    private updateServerOrder = (event: IpcMainEvent, serverOrder: string[]) => ServerManager.updateServerOrder(serverOrder);
}

const serverHub = new ServerHub();
export default serverHub;
