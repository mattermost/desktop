// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AuthenticationResponseDetails} from 'electron/renderer';
import React from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import type {LoginModalInfo} from 'types/modals';

import LoginModal from './loginModal';

import setupDarkMode from '../darkMode';

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
