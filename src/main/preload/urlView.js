// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {contextBridge, ipcRenderer} from 'electron';

import {UPDATE_URL_VIEW_WIDTH} from 'common/communication';

console.log('preloaded for the url view');

contextBridge.exposeInMainWorld('desktop', {
    updateURLViewWidth: (width) => ipcRenderer.send(UPDATE_URL_VIEW_WIDTH, width),
});
