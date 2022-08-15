// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    CALLS_CLIENT_CONNECT,
    CALLS_LEAVE_CALL,
} from 'common/communication';

contextBridge.exposeInMainWorld('ipcRenderer', {
    send: ipcRenderer.send,
    on: (channel, listener) => ipcRenderer.on(channel, (_, ...args) => listener(null, ...args)),
    invoke: ipcRenderer.invoke,
});

window.addEventListener('message', ({origin, data = {}} = {}) => {
    const {type, message = {}} = data;

    if (origin !== window.location.origin) {
        return;
    }

    switch (type) {
    case CALLS_CLIENT_CONNECT:
    case CALLS_LEAVE_CALL: {
        ipcRenderer.send(type, message);
        break;
    }
    }
});

