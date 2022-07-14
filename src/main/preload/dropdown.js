// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    UPDATE_TEAMS_DROPDOWN,
    REQUEST_TEAMS_DROPDOWN_INFO,
    RECEIVE_DROPDOWN_MENU_SIZE,
    SEND_DROPDOWN_MENU_SIZE,
    SWITCH_SERVER,
    CLOSE_TEAMS_DROPDOWN,
    SHOW_NEW_SERVER_MODAL,
    SHOW_EDIT_SERVER_MODAL,
    SHOW_REMOVE_SERVER_MODAL,
    UPDATE_TEAMS,
    GET_LANGUAGE_INFORMATION,
    RETRIEVED_LANGUAGE_INFORMATION,
} from 'common/communication';

console.log('preloaded for the dropdown!');

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
});

window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case REQUEST_TEAMS_DROPDOWN_INFO:
        ipcRenderer.send(REQUEST_TEAMS_DROPDOWN_INFO);
        break;
    case SEND_DROPDOWN_MENU_SIZE:
        ipcRenderer.send(RECEIVE_DROPDOWN_MENU_SIZE, event.data.data.width, event.data.data.height);
        break;
    case SWITCH_SERVER:
        ipcRenderer.send(SWITCH_SERVER, event.data.data);
        break;
    case SHOW_NEW_SERVER_MODAL:
        ipcRenderer.send(SHOW_NEW_SERVER_MODAL);
        break;
    case SHOW_EDIT_SERVER_MODAL:
        ipcRenderer.send(SHOW_EDIT_SERVER_MODAL, event.data.data.name);
        break;
    case SHOW_REMOVE_SERVER_MODAL:
        ipcRenderer.send(SHOW_REMOVE_SERVER_MODAL, event.data.data.name);
        break;
    case CLOSE_TEAMS_DROPDOWN:
        ipcRenderer.send(CLOSE_TEAMS_DROPDOWN);
        break;
    case UPDATE_TEAMS:
        ipcRenderer.invoke(UPDATE_TEAMS, event.data.data);
        break;
    case GET_LANGUAGE_INFORMATION:
        window.postMessage({type: RETRIEVED_LANGUAGE_INFORMATION, data: await ipcRenderer.invoke(GET_LANGUAGE_INFORMATION)});
        break;
    default:
        console.log(`got a message: ${event}`);
        console.log(event);
    }
});

ipcRenderer.on(UPDATE_TEAMS_DROPDOWN, (event, teams, activeTeam, darkMode, enableServerManagement, hasGPOTeams, expired, mentions, unreads, windowBounds) => {
    window.postMessage({type: UPDATE_TEAMS_DROPDOWN, data: {teams, activeTeam, darkMode, enableServerManagement, hasGPOTeams, expired, mentions, unreads, windowBounds}}, window.location.href);
});
