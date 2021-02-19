// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer} from 'electron';

import {MODAL_CANCEL, MODAL_RESULT, MODAL_INFO, RETRIEVE_MODAL_INFO, MODAL_SEND_IPC_MESSAGE} from 'common/communication';

console.log('preloaded for the modal!');

window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case MODAL_CANCEL: {
        console.log('canceling modal');
        ipcRenderer.send(MODAL_CANCEL, event.data.data);
        break;
    }
    case MODAL_RESULT: {
        console.log(`accepting modal with ${event.data.data}`);
        ipcRenderer.send(MODAL_RESULT, event.data.data);
        break;
    }
    case RETRIEVE_MODAL_INFO:
        console.log('getting modal data');
        window.postMessage({type: MODAL_INFO, data: await ipcRenderer.invoke(RETRIEVE_MODAL_INFO)}, window.location.href);
        break;
    case MODAL_SEND_IPC_MESSAGE:
        console.log('sending custom ipc message');
        ipcRenderer.send(event.data.data.type, ...event.data.data.args);
        break;
    default:
        console.log(`got a message: ${event}`);
        console.log(event);
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        ipcRenderer.send(MODAL_CANCEL);
    }
});
