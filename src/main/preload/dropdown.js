// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer} from 'electron';

import {UPDATE_TEAMS_DROPDOWN, REQUEST_TEAMS_DROPDOWN_INFO, RECEIVE_DROPDOWN_MENU_SIZE, SEND_DROPDOWN_MENU_SIZE} from 'common/communication';

console.log('preloaded for the dropdown!');

window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case REQUEST_TEAMS_DROPDOWN_INFO:
        ipcRenderer.send(REQUEST_TEAMS_DROPDOWN_INFO);
        break;
    case SEND_DROPDOWN_MENU_SIZE:
        ipcRenderer.send(RECEIVE_DROPDOWN_MENU_SIZE, event.data.data.width, event.data.data.height);
        break;
    default:
        console.log(`got a message: ${event}`);
        console.log(event);
    }
});

ipcRenderer.on(UPDATE_TEAMS_DROPDOWN, (event, teams, expired, mentions, unreads) => {
    console.log('update teams dropdown');
    window.postMessage({type: UPDATE_TEAMS_DROPDOWN, data: {teams, expired, mentions, unreads}}, window.location.href);
});
