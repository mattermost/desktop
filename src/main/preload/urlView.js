// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer} from 'electron';

import {UPDATE_URL_VIEW_WIDTH} from 'common/communication';

console.log('preloaded for the url view');

window.addEventListener('message', async (event) => {
    switch (event.data.type) {
    case UPDATE_URL_VIEW_WIDTH:
        ipcRenderer.send(UPDATE_URL_VIEW_WIDTH, event.data.data);
        break;
    default:
        console.log(`got a message: ${event}`);
        console.log(event);
    }
});
