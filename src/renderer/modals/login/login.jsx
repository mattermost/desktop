// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {MODAL_CANCEL, MODAL_RESULT} from 'common/communication.js';

import LoginModal from './loginModal.jsx';

const handleLoginCancel = (request) => {
  window.postMessage({type: MODAL_CANCEL, data: {request}}, window.location.href);
};

const handleLogin = (request, username, password) => {
  window.postMessage({type: MODAL_RESULT, data: {request, username, password}}, window.location.href);
};

const start = async () => {
  ReactDOM.render(
    <LoginModal
      onLogin={handleLogin}
      onCancel={handleLoginCancel}
    />,
    document.getElementById('app')
  );
};

start();
