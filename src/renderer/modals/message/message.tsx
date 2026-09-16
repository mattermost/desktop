// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import type {MessageModalInfo, MessageModalResult} from 'types/modals';

import MessageModal from './messageModal';

import setupDarkMode from '../darkMode';

setupDarkMode();

const onFinish = (result: MessageModalResult) => {
    window.desktop.modals.finishModal(result);
};

const getInfo = () => {
    return window.desktop.modals.getModalInfo<MessageModalInfo>();
};

const start = async () => {
    ReactDOM.render(
        <IntlProvider>
            <MessageModal
                onFinish={onFinish}
                getInfo={getInfo}
            />
        </IntlProvider>,
        document.getElementById('app'),
    );
};

start();
