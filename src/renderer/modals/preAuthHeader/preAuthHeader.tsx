// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import PreAuthHeaderModal from './preAuthHeaderModal';

import setupDarkMode from '../darkMode';

setupDarkMode();

const handleLoginCancel = () => {
    window.desktop.modals.cancelModal();
};

const handleSubmit = (secret: string) => {
    window.desktop.modals.finishModal(secret);
};

const getPreAuthInfo = () => {
    return window.desktop.modals.getModalInfo<{url: string}>();
};

const start = async () => {
    ReactDOM.render(
        <IntlProvider>
            <PreAuthHeaderModal
                onSubmit={handleSubmit}
                onCancel={handleLoginCancel}
                getPreAuthInfo={getPreAuthInfo}
            />
        </IntlProvider>,
        document.getElementById('app'),
    );
};

start();
