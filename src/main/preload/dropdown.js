// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer} from 'electron';

import {
    UPDATE_TEAMS_DROPDOWN,
    REQUEST_TEAMS_DROPDOWN_INFO,
    RECEIVE_DROPDOWN_MENU_SIZE,
    SEND_DROPDOWN_MENU_SIZE,
    SWITCH_SERVER,
    CLOSE_TEAMS_DROPDOWN,
    SHOW_NEW_SERVER_MODAL,
    UPDATE_TEAMS,
} from 'common/communication';

console.log('preloaded for the dropdown!');

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
    case CLOSE_TEAMS_DROPDOWN:
        ipcRenderer.send(CLOSE_TEAMS_DROPDOWN);
        break;
    case UPDATE_TEAMS:
        ipcRenderer.invoke(UPDATE_TEAMS, event.data.data);
        break;
    default:
        console.log(`got a message: ${event}`);
        console.log(event);
    }
});

ipcRenderer.on(UPDATE_TEAMS_DROPDOWN, (event, teams, activeTeam, darkMode, hasGPOTeams, expired, mentions, unreads) => {
    window.postMessage({type: UPDATE_TEAMS_DROPDOWN, data: {teams, activeTeam, darkMode, hasGPOTeams, expired, mentions, unreads}}, window.location.href);
});
