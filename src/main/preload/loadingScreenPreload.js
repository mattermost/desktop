// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer} from 'electron';

import {
    RECEIVED_LOADING_SCREEN_DATA,
    GET_LOADING_SCREEN_DATA,
    LOADING_SCREEN_ANIMATION_FINISHED,
    TOGGLE_LOADING_SCREEN_VISIBILITY,
    CLOSE_TEAMS_DROPDOWN,
    CLOSE_DOWNLOADS_DROPDOWN,
} from 'common/communication';

console.log('preloaded for the loading screen!');

window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case GET_LOADING_SCREEN_DATA:
        window.postMessage({type: RECEIVED_LOADING_SCREEN_DATA, data: await ipcRenderer.invoke(GET_LOADING_SCREEN_DATA)}, window.location.href);
        break;
    case LOADING_SCREEN_ANIMATION_FINISHED:
        ipcRenderer.send(LOADING_SCREEN_ANIMATION_FINISHED);
        break;
    default:
        console.log(`got a message: ${event}`);
        console.log(event);
    }
});

ipcRenderer.on(GET_LOADING_SCREEN_DATA, (_, result) => {
    window.postMessage({type: RECEIVED_LOADING_SCREEN_DATA, data: result}, window.location.href);
});

ipcRenderer.on(TOGGLE_LOADING_SCREEN_VISIBILITY, (_, toggle) => {
    window.postMessage({type: TOGGLE_LOADING_SCREEN_VISIBILITY, data: toggle}, window.location.href);
});

window.addEventListener('click', () => {
    ipcRenderer.send(CLOSE_TEAMS_DROPDOWN);
    ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN);
});
