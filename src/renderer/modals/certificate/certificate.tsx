// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Certificate} from 'electron/renderer';
import React from 'react';
import ReactDOM from 'react-dom';

import type {CertificateModalInfo} from 'types/modals';

import SelectCertificateModal from './certificateModal';

import setupDarkMode from '../darkMode';

setupDarkMode();

const handleCancel = () => {
    window.desktop.modals.cancelModal();
};

const handleSelect = (cert: Certificate) => {
    window.desktop.modals.finishModal({cert});
};

const getCertInfo = () => {
    return window.desktop.modals.getModalInfo<CertificateModalInfo>();
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
