// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

'use strict';

import {ipcRenderer, contextBridge} from 'electron';

import {
    GET_DARK_MODE,
    DARK_MODE_CHANGE,
    MODAL_CANCEL,
    MODAL_RESULT,
    RETRIEVE_MODAL_INFO,
    GET_MODAL_UNCLOSEABLE,
    PING_DOMAIN,
    GET_LANGUAGE_INFORMATION,
} from 'common/communication';

console.log('Preload initialized');

const createKeyDownListener = () => {
    ipcRenderer.invoke(GET_MODAL_UNCLOSEABLE).then((uncloseable) => {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !uncloseable) {
                ipcRenderer.send(MODAL_CANCEL);
            }
        });
    });
};
createKeyDownListener();

contextBridge.exposeInMainWorld('desktop', {
    getDarkMode: () => ipcRenderer.invoke(GET_DARK_MODE),
    onDarkModeChange: (listener) => ipcRenderer.on(DARK_MODE_CHANGE, (_, darkMode) => listener(darkMode)),
    getLanguageInformation: () => ipcRenderer.invoke(GET_LANGUAGE_INFORMATION),

    modals: {
        cancelModal: (data) => ipcRenderer.send(MODAL_CANCEL, data),
        finishModal: (data) => ipcRenderer.send(MODAL_RESULT, data),
        getModalInfo: () => ipcRenderer.invoke(RETRIEVE_MODAL_INFO),
        isModalUncloseable: () => ipcRenderer.invoke(GET_MODAL_UNCLOSEABLE),
        confirmProtocol: (protocol, url) => ipcRenderer.send('confirm-protocol', protocol, url),
        pingDomain: (url) => ipcRenderer.invoke(PING_DOMAIN, url),
    },
});
