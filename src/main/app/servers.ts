// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IpcMainEvent, IpcMainInvokeEvent, ipcMain} from 'electron';

import {UniqueServer, Server} from 'types/config';
import {URLValidationResult} from 'types/server';

import {UPDATE_SHORTCUT_MENU} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {MattermostServer} from 'common/servers/MattermostServer';
import {isValidURI, isValidURL, parseURL} from 'common/utils/url';
import {URLValidationStatus} from 'common/utils/constants';

import ViewManager from 'main/views/viewManager';
import ModalManager from 'main/views/modalManager';
import MainWindow from 'main/windows/mainWindow';
import {getLocalPreload, getLocalURLString} from 'main/utils';
import {ServerInfo} from 'main/server/serverInfo';

const log = new Logger('App.Servers');

export const switchServer = (serverId: string, waitForViewToExist = false) => {
    ServerManager.getServerLog(serverId, 'WindowManager').debug('switchServer');
    MainWindow.show();
    const server = ServerManager.getServer(serverId);
    if (!server) {
        ServerManager.getServerLog(serverId, 'WindowManager').error('Cannot find server in config');
        return;
    }
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
};

export const handleNewServerModal = () => {
    log.debug('handleNewServerModal');

    const html = getLocalURLString('newServer.html');

    const preload = getLocalPreload('desktopAPI.js');

    const mainWindow = MainWindow.get();
    if (!mainWindow) {
        return;
    }
    const modalPromise = ModalManager.addModal<null, Server>('newServer', html, preload, null, mainWindow, !ServerManager.hasServers());
    if (modalPromise) {
        modalPromise.then((data) => {
            const newServer = ServerManager.addServer(data);
            switchServer(newServer.id, true);
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the new server modal: ${e}`);
            }
        });
    } else {
        log.warn('There is already a new server modal');
    }
};

export const handleEditServerModal = (e: IpcMainEvent, id: string) => {
    log.debug('handleEditServerModal', id);

    const html = getLocalURLString('editServer.html');

    const preload = getLocalPreload('desktopAPI.js');

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
        html,
        preload,
        server.toUniqueServer(),
        mainWindow);
    if (modalPromise) {
        modalPromise.then((data) => ServerManager.editServer(id, data)).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the edit server modal: ${e}`);
            }
        });
    } else {
        log.warn('There is already an edit server modal');
    }
};

export const handleRemoveServerModal = (e: IpcMainEvent, id: string) => {
    log.debug('handleRemoveServerModal', id);

    const html = getLocalURLString('removeServer.html');

    const preload = getLocalPreload('desktopAPI.js');

    const server = ServerManager.getServer(id);
    if (!server) {
        return;
    }
    const mainWindow = MainWindow.get();
    if (!mainWindow) {
        return;
    }
    const modalPromise = ModalManager.addModal<string, boolean>('removeServer', html, preload, server.name, mainWindow);
    if (modalPromise) {
        modalPromise.then((remove) => {
            if (remove) {
                ServerManager.removeServer(server.id);
            }
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the edit server modal: ${e}`);
            }
        });
    } else {
        log.warn('There is already an edit server modal');
    }
};

export const handleServerURLValidation = async (e: IpcMainInvokeEvent, url?: string, currentId?: string): Promise<URLValidationResult> => {
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
    let remoteInfo = await testRemoteServer(secureURL);
    if (!remoteInfo) {
        if (secureURL.toString() !== parsedURL.toString()) {
            remoteURL = parsedURL;
            remoteInfo = await testRemoteServer(parsedURL);
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
            const remoteSiteURLInfo = await testRemoteServer(parsedSiteURL);
            if (!remoteSiteURLInfo) {
                return {status: URLValidationStatus.URLNotMatched, serverVersion: remoteInfo.serverVersion, serverName: remoteInfo.siteName, validatedURL: remoteURL.toString()};
            }
        }

        // Otherwise fix it for them and return
        return {status: URLValidationStatus.URLUpdated, serverVersion: remoteInfo.serverVersion, serverName: remoteInfo.siteName, validatedURL: remoteInfo.siteURL};
    }

    return {status: URLValidationStatus.OK, serverVersion: remoteInfo.serverVersion, serverName: remoteInfo.siteName, validatedURL: remoteInfo.siteURL};
};

const testRemoteServer = async (parsedURL: URL) => {
    const server = new MattermostServer({name: 'temp', url: parsedURL.toString()}, false);
    const serverInfo = new ServerInfo(server);
    try {
        const remoteInfo = await serverInfo.fetchRemoteInfo();
        return remoteInfo;
    } catch (error) {
        return undefined;
    }
};
