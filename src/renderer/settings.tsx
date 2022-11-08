// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/index.scss';
import 'renderer/css/settings.css';

import React from 'react';
import ReactDOM from 'react-dom';

import {DARK_MODE_CHANGE, GET_DARK_MODE} from 'common/communication';

import darkStyles from 'renderer/css/lazy/settings-dark.lazy.css';

import SettingsPage from './components/SettingsPage';
import IntlProvider from './intl_provider';

const setDarkMode = (darkMode: boolean) => {
    if (darkMode) {
        darkStyles.use();
    } else {
        darkStyles.unuse();
    }
};

window.ipcRenderer.on(DARK_MODE_CHANGE, (_, darkMode) => setDarkMode(darkMode));
window.ipcRenderer.invoke(GET_DARK_MODE).then(setDarkMode);

const start = async () => {
    ReactDOM.render(
        (
            <IntlProvider>
                <SettingsPage/>
            </IntlProvider>
        )
        ,
        document.getElementById('app'),
    );
};

// Deny drag&drop navigation in mainWindow.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());

start();
