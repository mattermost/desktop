// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {MODAL_CANCEL, MODAL_RESULT, RETRIEVE_MODAL_INFO, MODAL_SEND_IPC_MESSAGE} from 'common/communication';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import setupDarkMode from '../darkMode';

import PermissionModal from './permissionModal';

setupDarkMode();

const handleDeny = () => {
    window.postMessage({type: MODAL_CANCEL}, window.location.href);
};

const handleGrant = () => {
    window.postMessage({type: MODAL_RESULT}, window.location.href);
};

const getPermissionInfo = () => {
    window.postMessage({type: RETRIEVE_MODAL_INFO}, window.location.href);
};

const openExternalLink = (protocol: string, url: string) => {
    window.postMessage({type: MODAL_SEND_IPC_MESSAGE, data: {type: 'confirm-protocol', args: [protocol, url]}}, window.location.href);
};

const start = async () => {
    ReactDOM.render(
        <PermissionModal
            getPermissionInfo={getPermissionInfo}
            handleDeny={handleDeny}
            handleGrant={handleGrant}
            openExternalLink={openExternalLink}
        />,
        document.getElementById('app'),
    );
};

start();
