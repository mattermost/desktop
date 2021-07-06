// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React from 'react';
import ReactDOM from 'react-dom';

import {TeamWithIndex} from 'types/config';

import {DARK_MODE_CHANGE, GET_DARK_MODE, MODAL_CANCEL, MODAL_RESULT} from 'common/communication';

import NewTeamModal from '../../components/NewTeamModal'; //'./addServer.jsx';

import darkStyles from 'renderer/css/lazy/modals-dark.lazy.css';

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

const onClose = () => {
    window.postMessage({type: MODAL_CANCEL}, window.location.href);
};

const onSave = (data: TeamWithIndex) => {
    window.postMessage({type: MODAL_RESULT, data}, window.location.href);
};

const start = async () => {
    ReactDOM.render(
        <NewTeamModal
            onClose={onClose}
            onSave={onSave}
            editMode={false}
            show={true}
        />,
        document.getElementById('app'),
    );
};

start();
