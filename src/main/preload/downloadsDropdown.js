// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    CLOSE_DOWNLOADS_DROPDOWN_MENU,
    DOWNLOADS_DROPDOWN_FOCUSED,
    DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER,
    GET_LANGUAGE_INFORMATION,
    RECEIVE_DOWNLOADS_DROPDOWN_SIZE,
    REQUEST_CLEAR_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    RETRIEVED_LANGUAGE_INFORMATION,
    SEND_DOWNLOADS_DROPDOWN_SIZE,
    START_UPDATE_DOWNLOAD,
    START_UPGRADE,
    TOGGLE_DOWNLOADS_DROPDOWN_MENU,
    UPDATE_DOWNLOADS_DROPDOWN,
} from 'common/communication';

console.log('preloaded for the downloadsDropdown!');

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
});

window.addEventListener('click', () => {
    ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN_MENU);
});

window.addEventListener('mousemove', () => {
    ipcRenderer.send(DOWNLOADS_DROPDOWN_FOCUSED);
});

/**
 * renderer => main
 */
window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case CLOSE_DOWNLOADS_DROPDOWN:
        ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN);
        break;
    case TOGGLE_DOWNLOADS_DROPDOWN_MENU:
        ipcRenderer.send(TOGGLE_DOWNLOADS_DROPDOWN_MENU, event.data.payload);
        break;
    case REQUEST_DOWNLOADS_DROPDOWN_INFO:
        ipcRenderer.send(REQUEST_DOWNLOADS_DROPDOWN_INFO);
        break;
    case SEND_DOWNLOADS_DROPDOWN_SIZE:
        ipcRenderer.send(RECEIVE_DOWNLOADS_DROPDOWN_SIZE, event.data.data.width, event.data.data.height);
        break;
    case REQUEST_CLEAR_DOWNLOADS_DROPDOWN:
        ipcRenderer.send(REQUEST_CLEAR_DOWNLOADS_DROPDOWN);
        break;
    case DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER:
        ipcRenderer.send(DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER, event.data.payload.item);
        break;
    case START_UPDATE_DOWNLOAD:
        ipcRenderer.send(START_UPDATE_DOWNLOAD);
        break;
    case START_UPGRADE:
        ipcRenderer.send(START_UPGRADE);
        break;
    case GET_LANGUAGE_INFORMATION:
        window.postMessage({type: RETRIEVED_LANGUAGE_INFORMATION, data: await ipcRenderer.invoke(GET_LANGUAGE_INFORMATION)});
        break;
    default:
        console.log('Got an unknown message. Unknown messages are ignored');
    }
});

/**
 * main => renderer
 */
ipcRenderer.on(UPDATE_DOWNLOADS_DROPDOWN, (event, downloads, darkMode, windowBounds, item) => {
    window.postMessage({type: UPDATE_DOWNLOADS_DROPDOWN, data: {downloads, darkMode, windowBounds, item}}, window.location.href);
});
