// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/index.css';
import 'renderer/css/settings.css';

import React from 'react';
import ReactDOM from 'react-dom';

import SettingsPage from './components/SettingsPage.jsx';

function openMenu() {
    if (window.process.platform !== 'darwin') {
        window.ipcRenderer.send('open-app-menu');
    }
}

const start = async () => {
    ReactDOM.render(
        <SettingsPage
            openMenu={openMenu}
        />,
        document.getElementById('app'),
    );
};

// Deny drag&drop navigation in mainWindow.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());

start();
