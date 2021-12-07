// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, dialog, IpcMainEvent, IpcMainInvokeEvent, Menu} from 'electron';
import log from 'electron-log';

import {Team} from 'types/config';
import {MentionData} from 'types/notification';

import Config from 'common/config';
import {getDefaultTeamWithTabsFromTeam} from 'common/tabs/TabView';

import {displayMention} from 'main/notifications';
import {getLocalPreload, getLocalURLString} from 'main/utils';
import ModalManager from 'main/views/modalManager';
import WindowManager from 'main/windows/windowManager';

import {handleAppBeforeQuit} from './app';
import {updateServerInfos} from './utils';

export function handleReloadConfig() {
    Config.reload();
    WindowManager.handleUpdateConfig();
}

export function handleAppVersion() {
    return {
        name: app.getName(),
        version: app.getVersion(),
    };
}

export function handleQuit(e: IpcMainEvent, reason: string, stack: string) {
    log.error(`Exiting App. Reason: ${reason}`);
    log.info(`Stacktrace:\n${stack}`);
    handleAppBeforeQuit();
    app.quit();
}

export function handleSwitchServer(event: IpcMainEvent, serverName: string) {
    WindowManager.switchServer(serverName);
}

export function handleSwitchTab(event: IpcMainEvent, serverName: string, tabName: string) {
    WindowManager.switchTab(serverName, tabName);
}

export function handleCloseTab(event: IpcMainEvent, serverName: string, tabName: string) {
    const teams = Config.teams;
    teams.forEach((team) => {
        if (team.name === serverName) {
            team.tabs.forEach((tab) => {
                if (tab.name === tabName) {
                    tab.isOpen = false;
                }
            });
        }
    });
    const nextTab = teams.find((team) => team.name === serverName)!.tabs.filter((tab) => tab.isOpen)[0].name;
    WindowManager.switchTab(serverName, nextTab);
    Config.set('teams', teams);
}

export function handleOpenTab(event: IpcMainEvent, serverName: string, tabName: string) {
    const teams = Config.teams;
    teams.forEach((team) => {
        if (team.name === serverName) {
            team.tabs.forEach((tab) => {
                if (tab.name === tabName) {
                    tab.isOpen = true;
                }
            });
        }
    });
    WindowManager.switchTab(serverName, tabName);
    Config.set('teams', teams);
}

export function handleNewServerModal() {
    const html = getLocalURLString('newServer.html');

    const modalPreload = getLocalPreload('modalPreload.js');

    const mainWindow = WindowManager.getMainWindow();
    if (!mainWindow) {
        return;
    }
    const modalPromise = ModalManager.addModal<unknown, Team>('newServer', html, modalPreload, {}, mainWindow, Config.teams.length === 0);
    if (modalPromise) {
        modalPromise.then((data) => {
            const teams = Config.teams;
            const order = teams.length;
            const newTeam = getDefaultTeamWithTabsFromTeam({...data, order});
            teams.push(newTeam);
            Config.set('teams', teams);
            updateServerInfos([newTeam]);
            WindowManager.switchServer(newTeam.name, true);
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the new server modal: ${e}`);
            }
        });
    } else {
        log.warn('There is already a new server modal');
    }
}

export function handleEditServerModal(e: IpcMainEvent, name: string) {
    const html = getLocalURLString('editServer.html');

    const modalPreload = getLocalPreload('modalPreload.js');

    const mainWindow = WindowManager.getMainWindow();
    if (!mainWindow) {
        return;
    }
    const serverIndex = Config.teams.findIndex((team) => team.name === name);
    if (serverIndex < 0) {
        return;
    }
    const modalPromise = ModalManager.addModal<Team, Team>('editServer', html, modalPreload, Config.teams[serverIndex], mainWindow);
    if (modalPromise) {
        modalPromise.then((data) => {
            const teams = Config.teams;
            teams[serverIndex].name = data.name;
            teams[serverIndex].url = data.url;
            Config.set('teams', teams);
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the edit server modal: ${e}`);
            }
        });
    } else {
        log.warn('There is already an edit server modal');
    }
}

export function handleRemoveServerModal(e: IpcMainEvent, name: string) {
    const html = getLocalURLString('removeServer.html');

    const modalPreload = getLocalPreload('modalPreload.js');

    const mainWindow = WindowManager.getMainWindow();
    if (!mainWindow) {
        return;
    }
    const modalPromise = ModalManager.addModal<string, boolean>('removeServer', html, modalPreload, name, mainWindow);
    if (modalPromise) {
        modalPromise.then((remove) => {
            if (remove) {
                const teams = Config.teams;
                const removedTeam = teams.findIndex((team) => team.name === name);
                if (removedTeam < 0) {
                    return;
                }
                const removedOrder = teams[removedTeam].order;
                teams.splice(removedTeam, 1);
                teams.forEach((value) => {
                    if (value.order > removedOrder) {
                        value.order--;
                    }
                });
                Config.set('teams', teams);
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
}

export function handleMentionNotification(event: IpcMainEvent, title: string, body: string, channel: {id: string}, teamId: string, url: string, silent: boolean, data: MentionData) {
    displayMention(title, body, channel, teamId, url, silent, event.sender, data);
}

export function handleOpenAppMenu() {
    const windowMenu = Menu.getApplicationMenu();
    if (!windowMenu) {
        log.error('No application menu found');
        return;
    }
    windowMenu.popup({
        window: WindowManager.getMainWindow(),
        x: 18,
        y: 18,
    });
}

export async function handleSelectDownload(event: IpcMainInvokeEvent, startFrom: string) {
    const message = 'Specify the folder where files will download';
    const result = await dialog.showOpenDialog({defaultPath: startFrom || Config.downloadLocation,
        message,
        properties:
     ['openDirectory', 'createDirectory', 'dontAddToRecent', 'promptToCreate']});
    return result.filePaths[0];
}

export function handleUpdateLastActive(event: IpcMainEvent, serverName: string, viewName: string) {
    const teams = Config.teams;
    teams.forEach((team) => {
        if (team.name === serverName) {
            const viewOrder = team?.tabs.find((tab) => tab.name === viewName)?.order || 0;
            team.lastActiveTab = viewOrder;
        }
    });
    Config.set('teams', teams);
    Config.set('lastActiveTeam', teams.find((team) => team.name === serverName)?.order || 0);
}

