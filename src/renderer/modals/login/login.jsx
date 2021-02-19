// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {MODAL_CANCEL, MODAL_RESULT, RETRIEVE_MODAL_INFO} from 'common/communication.js';

import LoginModal from './loginModal.jsx';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

const handleLoginCancel = (request) => {
    window.postMessage({type: MODAL_CANCEL, data: {request}}, window.location.href);
};

const handleLogin = (request, username, password) => {
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
