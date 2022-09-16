// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer} from 'electron';

import {
    CALLS_LEAVE_CALL,
    CALLS_WIDGET_RESIZE,
} from 'common/communication';

window.addEventListener('message', ({origin, data = {}} = {}) => {
    const {type, message = {}} = data;

    if (origin !== window.location.origin) {
        return;
    }

    switch (type) {
    case CALLS_WIDGET_RESIZE:
    case CALLS_LEAVE_CALL: {
        ipcRenderer.send(type, message);
        break;
    }
    }
});
