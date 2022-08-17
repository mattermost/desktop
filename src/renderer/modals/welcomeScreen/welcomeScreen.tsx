// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import {ModalMessage} from 'types/modals';

import {
    MODAL_RESULT,
    GET_MODAL_UNCLOSEABLE,
    GET_DARK_MODE,
    DARK_MODE_CHANGE,
} from 'common/communication';
import IntlProvider from 'renderer/intl_provider';
import WelcomeScreen from '../../components/WelcomeScreen';

import 'bootstrap/dist/css/bootstrap.min.css';

const onGetStarted = () => {
    window.postMessage({type: MODAL_RESULT}, window.location.href);
};

const WelcomeScreenModalWrapper = () => {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        window.postMessage({type: GET_MODAL_UNCLOSEABLE}, window.location.href);
        window.postMessage({type: GET_DARK_MODE}, window.location.href);
        window.addEventListener('message', handleMessageEvent);

        return () => {
            window.removeEventListener('message', handleMessageEvent);
        };
    }, []);

    const handleMessageEvent = (event: {data: ModalMessage<boolean>}) => {
        if (event.data.type === DARK_MODE_CHANGE) {
            setDarkMode(event.data.data);
        }
    };

    return (
        <IntlProvider>
            <WelcomeScreen
                darkMode={darkMode}
                onGetStarted={onGetStarted}
            />
        </IntlProvider>
    );
};

const start = async () => {
    ReactDOM.render(
        <WelcomeScreenModalWrapper/>,
        document.getElementById('app'),
    );
};

start();
