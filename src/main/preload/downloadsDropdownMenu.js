// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    GET_LANGUAGE_INFORMATION,
    DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE,
    DOWNLOADS_DROPDOWN_MENU_SHOW_FILE_IN_FOLDER,
    DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD,
    DOWNLOADS_DROPDOWN_MENU_OPEN_FILE,
    UPDATE_DOWNLOADS_DROPDOWN_MENU,
    REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO,
} from 'common/communication';

console.log('preloaded for the downloadsDropdownMenu!');

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
});

contextBridge.exposeInMainWorld('desktop', {
    getLanguageInformation: () => ipcRenderer.invoke(GET_LANGUAGE_INFORMATION),

    downloadsDropdownMenu: {
        requestInfo: () => ipcRenderer.send(REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO),
        showInFolder: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_SHOW_FILE_IN_FOLDER, item),
        cancelDownload: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD, item),
        clearFile: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE, item),
        openFile: (item) => ipcRenderer.send(DOWNLOADS_DROPDOWN_MENU_OPEN_FILE, item),

        onUpdateDownloadsDropdownMenu: (listener) => ipcRenderer.on(UPDATE_DOWNLOADS_DROPDOWN_MENU, (_, item, darkMode) => listener(item, darkMode)),
    },
});
