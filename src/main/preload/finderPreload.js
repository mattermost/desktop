// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer} from 'electron';

import {FOUND_IN_PAGE, FIND_IN_PAGE, STOP_FIND_IN_PAGE, CLOSE_FINDER, FOCUS_FINDER} from 'common/communication';

console.log('preloaded for the finder!');

window.addEventListener('message', async (event) => {
  switch (event.data.type) {
  case FIND_IN_PAGE:
    ipcRenderer.send(FIND_IN_PAGE, event.data.data.searchText, event.data.data.options);
    break;
  case STOP_FIND_IN_PAGE:
    ipcRenderer.send(STOP_FIND_IN_PAGE, event.data.data);
    break;
  case CLOSE_FINDER:
    ipcRenderer.send(CLOSE_FINDER);
    break;
  case FOCUS_FINDER:
    ipcRenderer.send(FOCUS_FINDER);
    break;
  default:
    console.log(`got a message: ${event}`);
    console.log(event);
  }
});

ipcRenderer.on(FOUND_IN_PAGE, (event, result) => {
  window.postMessage({type: FOUND_IN_PAGE, data: result}, window.location.href);
});
