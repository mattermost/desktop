// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer} from 'electron';

import {MODAL_CANCEL, MODAL_RESULT} from 'common/communication';

window.addEventListener('message', ({origin, data}) => {
  if (origin !== window.location.origin) {
    return;
  }
  switch (data.type) {
  case MODAL_CANCEL: {
    ipcRenderer.send(MODAL_CANCEL);
    break;
  }
  case MODAL_RESULT: {
    ipcRenderer.send(MODAL_RESULT, data.data);
    break;
  }
  }
});