// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import {AuthenticationResponseDetails} from 'electron/renderer';

import {DARK_MODE_CHANGE, GET_DARK_MODE, MODAL_CANCEL, MODAL_RESULT, RETRIEVE_MODAL_INFO} from 'common/communication';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import darkStyles from 'renderer/css/lazy/modals-dark.lazy.css';

import LoginModal from './loginModal';

window.addEventListener('message', async (event) => {
    if (event.data.type === DARK_MODE_CHANGE) {
        if (event.data.data) {
            darkStyles.use();
        } else {
            darkStyles.unuse();
        }
    }
});
window.postMessage({type: GET_DARK_MODE}, window.location.href);

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
        <LoginModal
            onLogin={handleLogin}
            onCancel={handleLoginCancel}
            getAuthInfo={getAuthInfo}
        />,
        document.getElementById('app'),
    );
};

start();
