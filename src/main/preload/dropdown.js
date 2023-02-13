// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    UPDATE_TEAMS_DROPDOWN,
    REQUEST_TEAMS_DROPDOWN_INFO,
    RECEIVE_DROPDOWN_MENU_SIZE,
    SWITCH_SERVER,
    CLOSE_TEAMS_DROPDOWN,
    SHOW_NEW_SERVER_MODAL,
    SHOW_EDIT_SERVER_MODAL,
    SHOW_REMOVE_SERVER_MODAL,
    UPDATE_TEAMS,
    GET_LANGUAGE_INFORMATION,
} from 'common/communication';

console.log('preloaded for the dropdown!');

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
});

contextBridge.exposeInMainWorld('desktop', {
    closeTeamsDropdown: () => ipcRenderer.send(CLOSE_TEAMS_DROPDOWN),
    getLanguageInformation: () => ipcRenderer.invoke(GET_LANGUAGE_INFORMATION),
    updateTeams: (updatedTeams) => ipcRenderer.invoke(UPDATE_TEAMS, updatedTeams),

    serverDropdown: {
        requestInfo: () => ipcRenderer.send(REQUEST_TEAMS_DROPDOWN_INFO),
        sendSize: (width, height) => ipcRenderer.send(RECEIVE_DROPDOWN_MENU_SIZE, width, height),
        switchServer: (server) => ipcRenderer.send(SWITCH_SERVER, server),
        showNewServerModal: () => ipcRenderer.send(SHOW_NEW_SERVER_MODAL),
        showEditServerModal: (serverName) => ipcRenderer.send(SHOW_EDIT_SERVER_MODAL, serverName),
        showRemoveServerModal: (serverName) => ipcRenderer.send(SHOW_REMOVE_SERVER_MODAL, serverName),

        onUpdateServerDropdown: (listener) => ipcRenderer.on(UPDATE_TEAMS_DROPDOWN, (_,
            teams,
            activeTeam,
            darkMode,
            enableServerManagement,
            hasGPOTeams,
            expired,
            mentions,
            unreads,
            windowBounds,
        ) => listener(
            teams,
            activeTeam,
            darkMode,
            enableServerManagement,
            hasGPOTeams,
            expired,
            mentions,
            unreads,
            windowBounds,
        )),
    },
});
