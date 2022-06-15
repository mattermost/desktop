// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, dialog, IpcMainEvent, IpcMainInvokeEvent, Menu} from 'electron';
import log from 'electron-log';

import {Team, TeamWithIndex} from 'types/config';
import {MentionData} from 'types/notification';

import Config from 'common/config';
import {getDefaultTeamWithTabsFromTeam} from 'common/tabs/TabView';
import {ping} from 'common/utils/requests';

import {displayMention} from 'main/notifications';
import {getLocalPreload, getLocalURLString} from 'main/utils';
import ModalManager from 'main/views/modalManager';
import WindowManager from 'main/windows/windowManager';

import {handleAppBeforeQuit} from './app';
import {updateServerInfos} from './utils';

export function handleReloadConfig() {
    log.debug('Intercom.handleReloadConfig');

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
    log.silly('Intercom.handleSwitchServer', serverName);
    WindowManager.switchServer(serverName);
}

export function handleSwitchTab(event: IpcMainEvent, serverName: string, tabName: string) {
    log.silly('Intercom.handleSwitchTab', {serverName, tabName});
    WindowManager.switchTab(serverName, tabName);
}

export function handleCloseTab(event: IpcMainEvent, serverName: string, tabName: string) {
    log.debug('Intercom.handleCloseTab', {serverName, tabName});

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
    log.debug('Intercom.handleOpenTab', {serverName, tabName});

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

export function addNewServerModalWhenMainWindowIsShown() {
    const mainWindow = WindowManager.getMainWindow();
    if (mainWindow) {
        if (mainWindow.isVisible()) {
            handleNewServerModal();
        } else {
            mainWindow.once('show', () => {
                log.debug('Intercom.addNewServerModalWhenMainWindowIsShown.show');
                handleNewServerModal();
            });
        }
    }
}

export function handleNewServerModal() {
    log.debug('Intercom.handleNewServerModal');

    const html = getLocalURLString('newServer.html');

    const modalPreload = getLocalPreload('modalPreload.js');

    const mainWindow = WindowManager.getMainWindow();
    if (!mainWindow) {
        return;
    }
    const modalPromise = ModalManager.addModal<TeamWithIndex[], Team>('newServer', html, modalPreload, Config.teams.map((team, index) => ({...team, index})), mainWindow, Config.teams.length === 0);
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
    log.debug('Intercom.handleEditServerModal', name);

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
    const modalPromise = ModalManager.addModal<{currentTeams: TeamWithIndex[]; team: TeamWithIndex}, Team>(
        'editServer',
        html,
        modalPreload,
        {
            currentTeams: Config.teams.map((team, index) => ({...team, index})),
            team: {...Config.teams[serverIndex], index: serverIndex},
        },
        mainWindow);
    if (modalPromise) {
        modalPromise.then((data) => {
            const teams = Config.teams;
            teams[serverIndex].name = data.name;
            teams[serverIndex].url = data.url;
            Config.set('teams', teams);
            updateServerInfos([teams[serverIndex]]);
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
    log.debug('Intercom.handleRemoveServerModal', name);

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
    log.debug('Intercom.handleMentionNotification', {title, body, channel, teamId, url, silent, data});
    displayMention(title, body, channel, teamId, url, silent, event.sender, data);
}

export function handleOpenAppMenu() {
    log.debug('Intercom.handleOpenAppMenu');

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
    log.debug('Intercom.handleSelectDownload', startFrom);

    const message = 'Specify the folder where files will download';
    const result = await dialog.showOpenDialog({defaultPath: startFrom || Config.downloadLocation,
        message,
        properties:
     ['openDirectory', 'createDirectory', 'dontAddToRecent', 'promptToCreate']});
    return result.filePaths[0];
}

export function handleUpdateLastActive(event: IpcMainEvent, serverName: string, viewName: string) {
    log.debug('Intercom.handleUpdateLastActive', {serverName, viewName});

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

export function handlePingDomain(event: IpcMainInvokeEvent, url: string): Promise<string> {
    return Promise.allSettled([
        ping(new URL(`https://${url}`)),
        ping(new URL(`http://${url}`)),
    ]).then(([https, http]): string => {
        if (https.status === 'fulfilled') {
            return 'https';
        } else if (http.status === 'fulfilled') {
            return 'http';
        }
        throw new Error('Could not find server ' + url);
    });
}
