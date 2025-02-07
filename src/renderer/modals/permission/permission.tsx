// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import type {PermissionModalInfo} from 'types/modals';

import PermissionModal from './permissionModal';

import setupDarkMode from '../darkMode';

setupDarkMode();

const handleDeny = () => {
    window.desktop.modals.cancelModal();
};

const handleGrant = () => {
    window.desktop.modals.finishModal();
};

const getPermissionInfo = () => {
    return window.desktop.modals.getModalInfo<PermissionModalInfo>();
};

const openExternalLink = (protocol: string, url: string) => {
    window.desktop.modals.confirmProtocol(protocol, url);
};

const start = async () => {
    ReactDOM.render(
        <IntlProvider>
            <PermissionModal
                getPermissionInfo={getPermissionInfo}
                handleDeny={handleDeny}
                handleGrant={handleGrant}
                openExternalLink={openExternalLink}
            />
        </IntlProvider>,
        document.getElementById('app'),
    );
};

start();
