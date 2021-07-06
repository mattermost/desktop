// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import {Certificate} from 'electron/renderer';

import {DARK_MODE_CHANGE, GET_DARK_MODE, MODAL_CANCEL, MODAL_RESULT, RETRIEVE_MODAL_INFO} from 'common/communication';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';
import 'renderer/css/components/CertificateModal.css';

import darkStyles from 'renderer/css/lazy/modals-dark.lazy.css';

import SelectCertificateModal from './certificateModal';

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

const handleCancel = () => {
    window.postMessage({type: MODAL_CANCEL}, window.location.href);
};

const handleSelect = (cert: Certificate) => {
    window.postMessage({type: MODAL_RESULT, data: {cert}}, window.location.href);
};

const getCertInfo = () => {
    window.postMessage({type: RETRIEVE_MODAL_INFO}, window.location.href);
};

const start = async () => {
    ReactDOM.render(
        <SelectCertificateModal
            onSelect={handleSelect}
            onCancel={handleCancel}
            getCertInfo={getCertInfo}
        />,
        document.getElementById('app'),
    );
};

start();
