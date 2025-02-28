// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent} from 'electron';
import {ipcMain} from 'electron';

import {
    CLOSE_VIEW,
    GET_LAST_ACTIVE,
    GET_ORDERED_SERVERS,
    GET_ORDERED_TABS_FOR_SERVER,
    OPEN_VIEW,
    SHOW_EDIT_SERVER_MODAL,
    SHOW_NEW_SERVER_MODAL,
    SHOW_REMOVE_SERVER_MODAL,
    SWITCH_SERVER,
    TOGGLE_SECURE_INPUT,
    UPDATE_SERVER_ORDER,
    UPDATE_SHORTCUT_MENU,
    UPDATE_TAB_ORDER,
    VALIDATE_SERVER_URL,
    GET_UNIQUE_SERVERS_WITH_PERMISSIONS,
    ADD_SERVER,
    EDIT_SERVER,
    REMOVE_SERVER,
} from 'common/communication';
import Config from 'common/config';
import {ModalConstants} from 'common/constants';
import {Logger} from 'common/log';
import {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {URLValidationStatus} from 'common/utils/constants';
import {isValidURI, isValidURL, parseURL} from 'common/utils/url';
import PermissionsManager from 'main/permissionsManager';
import {ServerInfo} from 'main/server/serverInfo';
import {getLocalPreload} from 'main/utils';
import ModalManager from 'main/views/modalManager';
import ViewManager from 'main/views/viewManager';
import MainWindow from 'main/windows/mainWindow';

import type {Server, UniqueServer} from 'types/config';
import type {Permissions, UniqueServerWithPermissions} from 'types/permissions';
import type {URLValidationResult} from 'types/server';

const log = new Logger('App', 'ServerViewState');

export class ServerViewState {
    private currentServerId?: string;

    constructor() {
        ipcMain.on(SWITCH_SERVER, (event, serverId) => this.switchServer(serverId));
        ipcMain.on(SHOW_NEW_SERVER_MODAL, this.handleShowNewServerModal);
        ipcMain.on(SHOW_EDIT_SERVER_MODAL, this.showEditServerModal);
        ipcMain.on(SHOW_REMOVE_SERVER_MODAL, this.showRemoveServerModal);
        ipcMain.handle(VALIDATE_SERVER_URL, this.handleServerURLValidation);
        ipcMain.handle(GET_ORDERED_SERVERS, this.handleGetOrderedServers);
        ipcMain.on(UPDATE_SERVER_ORDER, this.updateServerOrder);

        ipcMain.on(CLOSE_VIEW, this.handleCloseView);
        ipcMain.on(OPEN_VIEW, this.handleOpenView);
        ipcMain.handle(GET_LAST_ACTIVE, this.handleGetLastActive);
        ipcMain.handle(GET_ORDERED_TABS_FOR_SERVER, this.handleGetOrderedViewsForServer);
        ipcMain.on(UPDATE_TAB_ORDER, this.updateTabOrder);

        ipcMain.handle(GET_UNIQUE_SERVERS_WITH_PERMISSIONS, this.getUniqueServersWithPermissions);
        ipcMain.on(ADD_SERVER, this.handleAddServer);
        ipcMain.on(EDIT_SERVER, this.handleEditServer);
        ipcMain.on(REMOVE_SERVER, this.handleRemoveServer);
    }

    init = () => {
        // Don't need to init twice
        if (this.currentServerId) {
            return;
        }

        const orderedServers = ServerManager.getOrderedServers();
        if (orderedServers.length) {
            if (Config.lastActiveServer && orderedServers[Config.lastActiveServer]) {
                this.currentServerId = orderedServers[Config.lastActiveServer].id;
            } else {
                this.currentServerId = orderedServers[0].id;
            }
        }
    };

    getCurrentServer = () => {
        log.silly('getCurrentServer');

        if (!this.currentServerId) {
            throw new Error('No server set as current');
        }
        const server = ServerManager.getServer(this.currentServerId);
        if (!server) {
            throw new Error('Current server does not exist');
        }
        return server;
    };

    switchServer = (serverId: string, waitForViewToExist = false) => {
        ServerManager.getServerLog(serverId, 'WindowManager').debug('switchServer');
        MainWindow.show();
        const server = ServerManager.getServer(serverId);
        if (!server) {
            ServerManager.getServerLog(serverId, 'WindowManager').error('Cannot find server in config');
            return;
        }
        ipcMain.emit(TOGGLE_SECURE_INPUT, null, false);
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
    };

    selectNextView = () => {
        this.selectView((order) => order + 1);
    };

    selectPreviousView = () => {
        this.selectView((order, length) => (length + (order - 1)));
    };

    updateCurrentView = (serverId: string, viewId: string) => {
        this.currentServerId = serverId;
        ServerManager.updateLastActive(viewId);
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

        const modalPromise = ModalManager.addModal<{prefillURL?: string}, Server>(
            ModalConstants.NEW_SERVER_MODAL,
            'mattermost-desktop://renderer/newServer.html',
            getLocalPreload('internalAPI.js'),
            {prefillURL},
            mainWindow,
            !ServerManager.hasServers(),
        );

        modalPromise.then((data) => {
            let initialLoadURL;
            if (prefillURL) {
                const parsedServerURL = parseURL(data.url);
                if (parsedServerURL) {
                    initialLoadURL = parseURL(`${parsedServerURL.origin}${prefillURL.substring(prefillURL.indexOf('/'))}`);
                }
            }
            const newServer = ServerManager.addServer(data, initialLoadURL);
            this.switchServer(newServer.id, true);
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

        const modalPromise = ModalManager.addModal<UniqueServerWithPermissions, {server: Server; permissions: Permissions}>(
            ModalConstants.EDIT_SERVER_MODAL,
            'mattermost-desktop://renderer/editServer.html',
            getLocalPreload('internalAPI.js'),
            {server: server.toUniqueServer(), permissions: PermissionsManager.getForServer(server) ?? {}},
            mainWindow);

        modalPromise.then((data) => {
            if (!server.isPredefined) {
                ServerManager.editServer(id, data.server);
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

        modalPromise.then((remove) => {
            if (remove) {
                const remainingServers = ServerManager.getOrderedServers().filter((orderedServer) => server.id !== orderedServer.id);
                if (this.currentServerId === server.id && remainingServers.length) {
                    this.currentServerId = remainingServers[0].id;
                }

                ServerManager.removeServer(server.id);

                if (!remainingServers.length) {
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

    /**
     * IPC Handlers
     */

    private handleServerURLValidation = async (e: IpcMainInvokeEvent, url?: string, currentId?: string): Promise<URLValidationResult> => {
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
        const existingServer = ServerManager.lookupViewByURL(secureURL, true);
        if (existingServer && existingServer.server.id !== currentId) {
            return {status: URLValidationStatus.URLExists, existingServerName: existingServer.server.name, validatedURL: existingServer.server.url.toString()};
        }

        // Try and get remote info from the most secure URL, otherwise use the insecure one
        let remoteURL = secureURL;
        const insecureURL = parseURL(secureURL.toString().replace(/^https:/, 'http:'));
        let remoteInfo = await this.testRemoteServer(secureURL);
        if (!remoteInfo && insecureURL) {
            // Try to fall back to HTTP
            remoteInfo = await this.testRemoteServer(insecureURL);
            if (remoteInfo) {
                remoteURL = insecureURL;
            }
        }

        // If we can't get the remote info, warn the user that this might not be the right URL
        // If the original URL was invalid, don't replace that as they probably have a typo somewhere
        // Also strip the trailing slash if it's there so that the user can keep typing
        if (!remoteInfo) {
            // If the URL provided has a path, try to validate the server with parts of the path removed, until we reach the root and then return a failure
            if (parsedURL.pathname !== '/') {
                return this.handleServerURLValidation(e, parsedURL.toString().substring(0, parsedURL.toString().lastIndexOf('/')), currentId);
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
                const existingServer = ServerManager.lookupViewByURL(parsedSiteURL, true);
                if (existingServer && existingServer.server.id !== currentId) {
                    return {status: URLValidationStatus.URLExists, existingServerName: existingServer.server.name, validatedURL: existingServer.server.url.toString()};
                }

                // If we can't reach the remote Site URL, there's probably a configuration issue
                const remoteSiteURLInfo = await this.testRemoteServer(parsedSiteURL);
                if (!remoteSiteURLInfo) {
                    return {status: URLValidationStatus.URLNotMatched, serverVersion: remoteInfo.serverVersion, serverName: remoteServerName, validatedURL: remoteURL.toString()};
                }
            }

            // Otherwise fix it for them and return
            return {status: URLValidationStatus.URLUpdated, serverVersion: remoteInfo.serverVersion, serverName: remoteServerName, validatedURL: remoteInfo.siteURL};
        }

        return {status: URLValidationStatus.OK, serverVersion: remoteInfo.serverVersion, serverName: remoteServerName, validatedURL: remoteURL.toString()};
    };

    private handleCloseView = (event: IpcMainEvent, viewId: string) => {
        log.debug('handleCloseView', {viewId});

        const view = ServerManager.getView(viewId);
        if (!view) {
            return;
        }
        ServerManager.setViewIsOpen(viewId, false);
        const nextView = ServerManager.getLastActiveTabForServer(view.server.id);
        ViewManager.showById(nextView.id);
    };

    private handleOpenView = (event: IpcMainEvent, viewId: string) => {
        log.debug('handleOpenView', {viewId});

        ServerManager.setViewIsOpen(viewId, true);
        ViewManager.showById(viewId);
    };

    private handleGetOrderedViewsForServer = (event: IpcMainInvokeEvent, serverId: string) => {
        return ServerManager.getOrderedTabsForServer(serverId).map((view) => view.toUniqueView());
    };

    private handleGetLastActive = () => {
        const server = this.getCurrentServer();
        const view = ServerManager.getLastActiveTabForServer(server.id);
        return {server: server.id, view: view.id};
    };

    private updateServerOrder = (event: IpcMainEvent, serverOrder: string[]) => ServerManager.updateServerOrder(serverOrder);
    private updateTabOrder = (event: IpcMainEvent, serverId: string, viewOrder: string[]) => ServerManager.updateTabOrder(serverId, viewOrder);

    private handleGetOrderedServers = () => ServerManager.getOrderedServers().map((srv) => srv.toUniqueServer());

    /**
     * Helper functions
     */

    private testRemoteServer = async (parsedURL: URL) => {
        const server = new MattermostServer({name: 'temp', url: parsedURL.toString()}, false);
        const serverInfo = new ServerInfo(server);
        try {
            const remoteInfo = await serverInfo.fetchConfigData();
            return remoteInfo;
        } catch (error) {
            return undefined;
        }
    };

    private selectView = (fn: (order: number, length: number) => number) => {
        const currentView = ViewManager.getCurrentView();
        if (!currentView) {
            return;
        }

        const currentServerViews = ServerManager.getOrderedTabsForServer(currentView.view.server.id).map((view, index) => ({view, index}));
        const filteredViews = currentServerViews?.filter((view) => view.view.isOpen);
        const currentServerView = currentServerViews?.find((view) => view.view.type === currentView.view.type);
        if (!currentServerViews || !currentServerView || !filteredViews) {
            return;
        }

        let currentOrder = currentServerView.index;
        let nextIndex = -1;
        while (nextIndex === -1) {
            const nextOrder = (fn(currentOrder, currentServerViews.length) % currentServerViews.length);
            nextIndex = filteredViews.findIndex((view) => view.index === nextOrder);
            currentOrder = nextOrder;
        }

        const newView = filteredViews[nextIndex].view;
        ViewManager.showById(newView.id);
    };

    private getUniqueServersWithPermissions = () => {
        return ServerManager.getAllServers().
            map((server) => ({
                server: server.toUniqueServer(),
                permissions: PermissionsManager.getForServer(server) ?? {},
            }));
    };

    private handleAddServer = (event: IpcMainEvent, server: Server) => {
        log.debug('handleAddServer', server);

        ServerManager.addServer(server);
    };

    private handleEditServer = (event: IpcMainEvent, server: UniqueServer, permissions?: Permissions) => {
        log.debug('handleEditServer', server, permissions);

        if (!server.id) {
            return;
        }

        if (!server.isPredefined) {
            ServerManager.editServer(server.id, server);
        }
        if (permissions) {
            const mattermostServer = ServerManager.getServer(server.id);
            if (mattermostServer) {
                PermissionsManager.setForServer(mattermostServer, permissions);
            }
        }
    };

    private handleRemoveServer = (event: IpcMainEvent, serverId: string) => {
        log.debug('handleRemoveServer', serverId);

        const remainingServers = ServerManager.getOrderedServers().filter((orderedServer) => serverId !== orderedServer.id);
        if (this.currentServerId === serverId && remainingServers.length) {
            this.currentServerId = remainingServers[0].id;
        } else if (!remainingServers.length) {
            delete this.currentServerId;
        }

        ServerManager.removeServer(serverId);
    };
}

const serverViewState = new ServerViewState();
export default serverViewState;
