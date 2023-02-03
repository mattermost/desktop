// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {ipcRenderer} from 'electron';

import {
    CALLS_LEAVE_CALL,
    CALLS_JOINED_CALL,
    CALLS_POPOUT_FOCUS,
    CALLS_WIDGET_RESIZE,
    CALLS_WIDGET_SHARE_SCREEN,
    CALLS_WIDGET_CHANNEL_LINK_CLICK,
    DESKTOP_SOURCES_RESULT,
    DESKTOP_SOURCES_MODAL_REQUEST,
    DISPATCH_GET_DESKTOP_SOURCES,
} from 'common/communication';

window.addEventListener('message', ({origin, data = {}} = {}) => {
    const {type, message = {}} = data;

    if (origin !== window.location.origin) {
        return;
    }

    switch (type) {
    case 'get-app-version': {
        ipcRenderer.invoke('get-app-version').then(({name, version}) => {
            window.postMessage(
                {
                    type: 'register-desktop',
                    message: {
                        name,
                        version,
                    },
                },
                window.location.origin,
            );
        });
        break;
    }
    case 'get-desktop-sources': {
        ipcRenderer.send(DISPATCH_GET_DESKTOP_SOURCES, 'widget', message);
        break;
    }
    case DESKTOP_SOURCES_MODAL_REQUEST:
    case CALLS_WIDGET_CHANNEL_LINK_CLICK:
    case CALLS_WIDGET_RESIZE:
    case CALLS_JOINED_CALL:
    case CALLS_POPOUT_FOCUS:
    case CALLS_LEAVE_CALL: {
        ipcRenderer.send(type, message);
        break;
    }
    }
});

ipcRenderer.on(DESKTOP_SOURCES_RESULT, (event, sources) => {
    window.postMessage(
        {
            type: DESKTOP_SOURCES_RESULT,
            message: sources,
        },
        window.location.origin,
    );
});

ipcRenderer.on(CALLS_WIDGET_SHARE_SCREEN, (event, message) => {
    window.postMessage(
        {
            type: CALLS_WIDGET_SHARE_SCREEN,
            message,
        },
        window.location.origin,
    );
});
