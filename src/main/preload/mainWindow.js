// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import os from 'os';
import {ipcRenderer, contextBridge} from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', {
    send: ipcRenderer.send,
    on: (channel, listener) => ipcRenderer.on(channel, (_, ...args) => listener(null, ...args)),
    invoke: ipcRenderer.invoke,
});

contextBridge.exposeInMainWorld('os', {
    isWindows10: os.platform() === 'win32' && os.release().startsWith('10'),
});

contextBridge.exposeInMainWorld('process', {
    platform: process.platform,
    env: process.env,
});

contextBridge.exposeInMainWorld('timers', {
    setImmediate,
});

