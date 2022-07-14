// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    GET_LANGUAGE_INFORMATION,
    RETRIEVED_LANGUAGE_INFORMATION,
} from 'common/communication';

contextBridge.exposeInMainWorld('ipcRenderer', {
    send: ipcRenderer.send,
    on: (channel, listener) => ipcRenderer.on(channel, (_, ...args) => listener(null, ...args)),
    invoke: ipcRenderer.invoke,
});

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
    env: {
        user: process.env.USER,
        username: process.env.USERNAME,
    },
});

contextBridge.exposeInMainWorld('timers', {
    setImmediate,
});

window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case GET_LANGUAGE_INFORMATION:
        window.postMessage({type: RETRIEVED_LANGUAGE_INFORMATION, data: await ipcRenderer.invoke(GET_LANGUAGE_INFORMATION)});
        break;
    }
});

