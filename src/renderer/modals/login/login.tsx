// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import {AuthenticationResponseDetails} from 'electron/renderer';

import {MODAL_CANCEL, MODAL_RESULT, RETRIEVE_MODAL_INFO} from 'common/communication';

import IntlProvider from 'renderer/intl_provider';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import setupDarkMode from '../darkMode';

import LoginModal from './loginModal';

setupDarkMode();

const handleLoginCancel = (request: AuthenticationResponseDetails) => {
    window.postMessage({type: MODAL_CANCEL, data: {request}}, window.location.href);
};

const handleLogin = (request: AuthenticationResponseDetails, username: string, password: string) => {
    window.postMessage({type: MODAL_RESULT, data: {request, username, password}}, window.location.href);
};

const getAuthInfo = () => {
    window.postMessage({type: RETRIEVE_MODAL_INFO}, window.location.href);
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
