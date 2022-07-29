// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';

import React from 'react';
import ReactDOM from 'react-dom';

import {MODAL_RESULT} from 'common/communication';

import IntlProvider from 'renderer/intl_provider';

import WelcomeScreen from '../../components/WelcomeScreen';

import setupDarkMode from '../darkMode';

setupDarkMode();

const onGetStarted = () => {
    window.postMessage({type: MODAL_RESULT}, window.location.href);
};

const WelcomeScreenModalWrapper = () => (
    <IntlProvider>
        <WelcomeScreen
            onGetStarted={onGetStarted}
        />
    </IntlProvider>
);

const start = async () => {
    ReactDOM.render(
        <WelcomeScreenModalWrapper/>,
        document.getElementById('app'),
    );
};

start();
