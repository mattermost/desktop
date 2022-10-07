// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    GET_LANGUAGE_INFORMATION,
    DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE,
    RETRIEVED_LANGUAGE_INFORMATION,
    DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER,
    DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD,
    DOWNLOADS_DROPDOWN_MENU_OPEN_FILE,
    UPDATE_DOWNLOADS_DROPDOWN_MENU,
    REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO,
} from 'common/communication';

console.log('preloaded for the downloadsDropdownMenu!');

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
});

/**
 * renderer => main
 */
window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO:
        ipcRenderer.send(REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO);
        break;
    case DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER:
        ipcRenderer.send(DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER, event.data.payload.item);
        break;
    case DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD:
        ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD, event.data.payload.item);
        break;
    case DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE:
        ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE, event.data.payload.item);
        break;
    case DOWNLOADS_DROPDOWN_MENU_OPEN_FILE:
        ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_OPEN_FILE, event.data.payload.item);
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
ipcRenderer.on(UPDATE_DOWNLOADS_DROPDOWN_MENU, (event, item, darkMode) => {
    window.postMessage({type: UPDATE_DOWNLOADS_DROPDOWN_MENU, data: {item, darkMode}}, window.location.href);
});
