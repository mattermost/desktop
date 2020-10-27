// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer} from 'electron';

import {MODAL_CANCEL, MODAL_RESULT} from 'common/communication';

console.log('preloaded for the modal!');

window.addEventListener('message', (event) => {
  switch (event.data.type) {
  case MODAL_CANCEL: {
    console.log('canceling modal');
    ipcRenderer.send(MODAL_CANCEL);
    break;
  }
  case MODAL_RESULT: {
    console.log(`accepting modal with ${event.data.data}`);
    ipcRenderer.send(MODAL_RESULT, event.data.data);
    break;
  }
  default:
    console.log(`got a message: ${event}`);
    console.log(event);
  }
});