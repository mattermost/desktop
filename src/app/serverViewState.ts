// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IpcMainEvent, IpcMainInvokeEvent, ipcMain} from 'electron';

import {UniqueServer, Server} from 'types/config';
import {URLValidationResult} from 'types/server';

import {
    SHOW_EDIT_SERVER_MODAL,
    SHOW_NEW_SERVER_MODAL,
    SHOW_REMOVE_SERVER_MODAL,
    SWITCH_SERVER,
    UPDATE_SHORTCUT_MENU,
    VALIDATE_SERVER_URL,
} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {MattermostServer} from 'common/servers/MattermostServer';
import {isValidURI, isValidURL, parseURL} from 'common/utils/url';
import {URLValidationStatus} from 'common/utils/constants';
import Config from 'common/config';

import ViewManager from 'main/views/viewManager';
import ModalManager from 'main/views/modalManager';
import MainWindow from 'main/windows/mainWindow';
import {getLocalPreload, getLocalURLString} from 'main/utils';
import {ServerInfo} from 'main/server/serverInfo';

const log = new Logger('App', 'ServerViewState');

export class ServerViewState {
    private currentServerId?: string;

    constructor() {
        ipcMain.on(SWITCH_SERVER, (event, serverId) => this.switchServer(serverId));
        ipcMain.on(SHOW_NEW_SERVER_MODAL, this.showNewServerModal);
        ipcMain.on(SHOW_EDIT_SERVER_MODAL, this.showEditServerModal);
        ipcMain.on(SHOW_REMOVE_SERVER_MODAL, this.showRemoveServerModal);
        ipcMain.handle(VALIDATE_SERVER_URL, this.handleServerURLValidation);
    }

    init = () => {
        const orderedServers = ServerManager.getOrderedServers();
        if (Config.lastActiveServer && orderedServers[Config.lastActiveServer]) {
            this.currentServerId = orderedServers[Config.lastActiveServer].id;
        } else {
            this.currentServerId = orderedServers[0].id;
        }
    }

    getCurrentServer = () => {
        log.debug('getCurrentServer');

        if (!this.currentServerId) {
            throw new Error('No server set as current');
        }
        const server = ServerManager.getServer(this.currentServerId);
        if (!server) {
            throw new Error('Current server does not exist');
        }
        return server;
    }

    switchServer = (serverId: string, waitForViewToExist = false) => {
        ServerManager.getServerLog(serverId, 'WindowManager').debug('switchServer');
        MainWindow.show();
        const server = ServerManager.getServer(serverId);
        if (!server) {
            ServerManager.getServerLog(serverId, 'WindowManager').error('Cannot find server in config');
            return;
        }
        this.currentServerId = serverId;
        const nextView = ServerManager.getLastActiveTabForServer(serverId);
        if (waitForViewToExist) {
            const timeout = setInterval(() => {
                if (ViewManager.getView(nextView.id)) {
                    ViewManager.showById(nextView.id);
                    clearInterval(timeout);
                }
            }, 100);
        } else {
            ViewManager.showById(nextView.id);
        }
        ipcMain.emit(UPDATE_SHORTCUT_MENU);
    }

    updateCurrentView = (serverId: string, viewId: string) => {
        this.currentServerId = serverId;
        ServerManager.updateLastActive(viewId);
    }

    showNewServerModal = () => {
        log.debug('showNewServerModal');

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        const modalPromise = ModalManager.addModal<null, Server>(
            'newServer',
            getLocalURLString('newServer.html'),
            getLocalPreload('desktopAPI.js'),
            null,
            mainWindow,
            !ServerManager.hasServers(),
        );

        modalPromise.then((data) => {
            const newServer = ServerManager.addServer(data);
            this.switchServer(newServer.id, true);
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the new server modal: ${e}`);
            }
        });
    };

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

        const modalPromise = ModalManager.addModal<UniqueServer, Server>(
            'editServer',
            getLocalURLString('editServer.html'),
            getLocalPreload('desktopAPI.js'),
            server.toUniqueServer(),
            mainWindow);

        modalPromise.then((data) => ServerManager.editServer(id, data)).catch((e) => {
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

        const modalPromise = ModalManager.addModal<string, boolean>(
            'removeServer',
            getLocalURLString('removeServer.html'),
            getLocalPreload('desktopAPI.js'),
            server.name,
            mainWindow,
        );

        modalPromise.then((remove) => {
            if (remove) {
                ServerManager.removeServer(server.id);

                if (this.currentServerId === server.id && ServerManager.hasServers()) {
                    this.currentServerId = ServerManager.getOrderedServers()[0].id;
                }

                if (!ServerManager.hasServers()) {
                    delete this.currentServerId;
                }
            }
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the edit server modal: ${e}`);
            }
        });
    };

    private handleServerURLValidation = async (e: IpcMainInvokeEvent, url?: string, currentId?: string): Promise<URLValidationResult> => {
        log.debug('handleServerURLValidation', url, currentId);

        // If the URL is missing or null, reject
        if (!url) {
            return {status: URLValidationStatus.Missing};
        }

        let httpUrl = url;
        if (!isValidURL(url)) {
            // If it already includes the protocol, tell them it's invalid
            if (isValidURI(url)) {
                httpUrl = url.replace(/^(.+):/, 'https:');
            } else {
                // Otherwise add HTTPS for them
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
        const existingServer = ServerManager.lookupViewByURL(secureURL, true);
        if (existingServer && existingServer.server.id !== currentId) {
            return {status: URLValidationStatus.URLExists, existingServerName: existingServer.server.name, validatedURL: existingServer.server.url.toString()};
        }

        // Try and get remote info from the most secure URL, otherwise use the insecure one
        let remoteURL = secureURL;
        let remoteInfo = await this.testRemoteServer(secureURL);
        if (!remoteInfo) {
            if (secureURL.toString() !== parsedURL.toString()) {
                remoteURL = parsedURL;
                remoteInfo = await this.testRemoteServer(parsedURL);
            }
        }

        // If we can't get the remote info, warn the user that this might not be the right URL
        // If the original URL was invalid, don't replace that as they probably have a typo somewhere
        if (!remoteInfo) {
            return {status: URLValidationStatus.NotMattermost, validatedURL: parsedURL.toString()};
        }

        // If we were only able to connect via HTTP, warn the user that the connection is not secure
        if (remoteURL.protocol === 'http:') {
            return {status: URLValidationStatus.Insecure, serverVersion: remoteInfo.serverVersion, validatedURL: remoteURL.toString()};
        }

        // If the URL doesn't match the Site URL, set the URL to the correct one
        if (remoteInfo.siteURL && remoteURL.toString() !== new URL(remoteInfo.siteURL).toString()) {
            const parsedSiteURL = parseURL(remoteInfo.siteURL);
            if (parsedSiteURL) {
                // Check the Site URL as well to see if it's already pre-configured
                const existingServer = ServerManager.lookupViewByURL(parsedSiteURL, true);
                if (existingServer && existingServer.server.id !== currentId) {
                    return {status: URLValidationStatus.URLExists, existingServerName: existingServer.server.name, validatedURL: existingServer.server.url.toString()};
                }

                // If we can't reach the remote Site URL, there's probably a configuration issue
                const remoteSiteURLInfo = await this.testRemoteServer(parsedSiteURL);
                if (!remoteSiteURLInfo) {
                    return {status: URLValidationStatus.URLNotMatched, serverVersion: remoteInfo.serverVersion, serverName: remoteInfo.siteName, validatedURL: remoteURL.toString()};
                }
            }

            // Otherwise fix it for them and return
            return {status: URLValidationStatus.URLUpdated, serverVersion: remoteInfo.serverVersion, serverName: remoteInfo.siteName, validatedURL: remoteInfo.siteURL};
        }

        return {status: URLValidationStatus.OK, serverVersion: remoteInfo.serverVersion, serverName: remoteInfo.siteName, validatedURL: remoteInfo.siteURL};
    };

    private testRemoteServer = async (parsedURL: URL) => {
        const server = new MattermostServer({name: 'temp', url: parsedURL.toString()}, false);
        const serverInfo = new ServerInfo(server);
        try {
            const remoteInfo = await serverInfo.fetchRemoteInfo();
            return remoteInfo;
        } catch (error) {
            return undefined;
        }
    };
}

const serverViewState = new ServerViewState();
export default serverViewState;
