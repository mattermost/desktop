// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/index.css';
import 'renderer/css/settings.css';

import React from 'react';
import ReactDOM from 'react-dom';

import SettingsPage from '../../components/SettingsPage';
import IntlProvider from '../../intl_provider';
import setupDarkMode from '../darkMode';

setupDarkMode();

const onClose = () => {
    window.desktop.modals.finishModal();
};

const start = async () => {
    ReactDOM.render(
        (
            <IntlProvider>
                <SettingsPage
                    show={true}
                    onClose={onClose}
                />
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
