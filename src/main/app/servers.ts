// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IpcMainEvent, ipcMain} from 'electron';

import {UniqueServer, Server} from 'types/config';

import {UPDATE_SHORTCUT_MENU} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';

import ViewManager from 'main/views/viewManager';
import ModalManager from 'main/views/modalManager';
import MainWindow from 'main/windows/mainWindow';
import {getLocalPreload, getLocalURLString} from 'main/utils';

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
    const modalPromise = ModalManager.addModal<UniqueServer[], Server>('newServer', html, preload, ServerManager.getAllServers().map((server) => server.toUniqueServer()), mainWindow, !ServerManager.hasServers());
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
    const modalPromise = ModalManager.addModal<{currentServers: UniqueServer[]; server: UniqueServer}, Server>(
        'editServer',
        html,
        preload,
        {
            currentServers: ServerManager.getAllServers().map((server) => server.toUniqueServer()),
            server: server.toUniqueServer(),
        },
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
