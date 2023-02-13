// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    CLOSE_DOWNLOADS_DROPDOWN_MENU,
    DOWNLOADS_DROPDOWN_FOCUSED,
    GET_LANGUAGE_INFORMATION,
    RECEIVE_DOWNLOADS_DROPDOWN_SIZE,
    REQUEST_CLEAR_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    START_UPDATE_DOWNLOAD,
    START_UPGRADE,
    TOGGLE_DOWNLOADS_DROPDOWN_MENU,
    UPDATE_DOWNLOADS_DROPDOWN,
    GET_DOWNLOADED_IMAGE_THUMBNAIL_LOCATION,
    DOWNLOADS_DROPDOWN_OPEN_FILE,
} from 'common/communication';

console.log('preloaded for the downloadsDropdown!');

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
});

contextBridge.exposeInMainWorld('mas', {
    getThumbnailLocation: (location) => ipcRenderer.invoke(GET_DOWNLOADED_IMAGE_THUMBNAIL_LOCATION, location),
});

contextBridge.exposeInMainWorld('desktop', {
    getLanguageInformation: () => ipcRenderer.invoke(GET_LANGUAGE_INFORMATION),
    closeDownloadsDropdown: () => ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN),

    downloadsDropdown: {
        toggleDownloadsDropdownMenu: (payload) => ipcRenderer.send(TOGGLE_DOWNLOADS_DROPDOWN_MENU, payload),
        requestInfo: () => ipcRenderer.send(REQUEST_DOWNLOADS_DROPDOWN_INFO),
        sendSize: (width, height) => ipcRenderer.send(RECEIVE_DOWNLOADS_DROPDOWN_SIZE, width, height),
        requestClearDownloadsDropdown: () => ipcRenderer.send(REQUEST_CLEAR_DOWNLOADS_DROPDOWN),
        openFile: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_OPEN_FILE, item),
        startUpdateDownload: () => ipcRenderer.send(START_UPDATE_DOWNLOAD),
        startUpgrade: () => ipcRenderer.send(START_UPGRADE),

        onUpdateDownloadsDropdown: (listener) => ipcRenderer.on(UPDATE_DOWNLOADS_DROPDOWN, (_, downloads, darkMode, windowBounds, item) => listener(downloads, darkMode, windowBounds, item)),
    },
});

window.addEventListener('click', () => {
    ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN_MENU);
});

window.addEventListener('mousemove', () => {
    ipcRenderer.send(DOWNLOADS_DROPDOWN_FOCUSED);
});
