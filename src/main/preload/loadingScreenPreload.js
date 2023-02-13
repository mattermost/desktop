// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {contextBridge, ipcRenderer} from 'electron';

import {
    GET_DARK_MODE,
    DARK_MODE_CHANGE,
    LOADING_SCREEN_ANIMATION_FINISHED,
    TOGGLE_LOADING_SCREEN_VISIBILITY,
    CLOSE_TEAMS_DROPDOWN,
    CLOSE_DOWNLOADS_DROPDOWN,
} from 'common/communication';

console.log('preloaded for the loading screen!');

contextBridge.exposeInMainWorld('desktop', {
    getDarkMode: () => ipcRenderer.invoke(GET_DARK_MODE),
    onDarkModeChange: (listener) => ipcRenderer.on(DARK_MODE_CHANGE, (_, darkMode) => listener(darkMode)),

    loadingScreen: {
        loadingScreenAnimationFinished: () => ipcRenderer.send(LOADING_SCREEN_ANIMATION_FINISHED),
        onToggleLoadingScreenVisibility: (listener) => ipcRenderer.on(TOGGLE_LOADING_SCREEN_VISIBILITY, (_, toggle) => listener(toggle)),
    },
});

window.addEventListener('click', () => {
    ipcRenderer.send(CLOSE_TEAMS_DROPDOWN);
    ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN);
});
