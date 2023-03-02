// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import {AuthenticationResponseDetails} from 'electron/renderer';

import {LoginModalInfo} from 'types/modals';

import IntlProvider from 'renderer/intl_provider';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import setupDarkMode from '../darkMode';

import LoginModal from './loginModal';

setupDarkMode();

const handleLoginCancel = (request: AuthenticationResponseDetails) => {
    window.desktop.modals.cancelModal({request});
};

const handleLogin = (request: AuthenticationResponseDetails, username: string, password: string) => {
    window.desktop.modals.finishModal({request, username, password});
};

const getAuthInfo = () => {
    return window.desktop.modals.getModalInfo<LoginModalInfo>();
};

const start = async () => {
    ReactDOM.render(
        <IntlProvider>
            <LoginModal
                onLogin={handleLogin}
                onCancel={handleLoginCancel}
                getAuthInfo={getAuthInfo}
            />
        </IntlProvider>,
        document.getElementById('app'),
    );
};

start();
