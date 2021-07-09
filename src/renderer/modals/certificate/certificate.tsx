// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import {Certificate} from 'electron/renderer';

import {MODAL_CANCEL, MODAL_RESULT, RETRIEVE_MODAL_INFO} from 'common/communication';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';
import 'renderer/css/components/CertificateModal.css';

import setupDarkMode from '../darkMode';

import SelectCertificateModal from './certificateModal';

setupDarkMode();

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
