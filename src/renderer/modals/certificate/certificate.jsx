// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {MODAL_CANCEL, MODAL_RESULT, RETRIEVE_MODAL_INFO} from 'common/communication.js';

import SelectCertificateModal from './certificateModal.jsx';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';
import 'renderer/css/components/CertificateModal.css';

const handleCancel = () => {
    window.postMessage({type: MODAL_CANCEL}, window.location.href);
};

const handleSelect = (cert) => {
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
