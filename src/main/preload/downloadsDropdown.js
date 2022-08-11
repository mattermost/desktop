// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    OPEN_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    UPDATE_DOWNLOADS_DROPDOWN,
} from 'common/communication';

console.log('preloaded for the downloadsDropdown!');

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
});

window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case CLOSE_DOWNLOADS_DROPDOWN:
        ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN);
        break;
    case OPEN_DOWNLOADS_DROPDOWN:
        ipcRenderer.send(OPEN_DOWNLOADS_DROPDOWN);
        break;
    case REQUEST_DOWNLOADS_DROPDOWN_INFO:
        ipcRenderer.send(REQUEST_DOWNLOADS_DROPDOWN_INFO);
        break;
    case UPDATE_DOWNLOADS_DROPDOWN:
        ipcRenderer.send(UPDATE_DOWNLOADS_DROPDOWN, event.data.downloads);
        break;
    default:
        console.log(`got a message: ${event}`);
        console.log(event);
    }
});

ipcRenderer.on(UPDATE_DOWNLOADS_DROPDOWN, (event, downloads, darkMode, windowBounds) => {
    window.postMessage({type: UPDATE_DOWNLOADS_DROPDOWN, data: {downloads, darkMode, windowBounds}}, window.location.href);
});
