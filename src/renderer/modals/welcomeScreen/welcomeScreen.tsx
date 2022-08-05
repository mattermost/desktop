// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import {ModalMessage} from 'types/modals';

import {MODAL_RESULT, RETRIEVE_MODAL_INFO, MODAL_INFO, GET_MODAL_UNCLOSEABLE} from 'common/communication';
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
        window.postMessage({type: RETRIEVE_MODAL_INFO}, window.location.href);
        window.addEventListener('message', handleMessageEvent);

        return () => {
            window.removeEventListener('message', handleMessageEvent);
        };
    }, []);

    const handleMessageEvent = (event: {data: ModalMessage<{darkMode: boolean}>}) => {
        if (event.data.type === MODAL_INFO) {
            setDarkMode(event.data.data.darkMode);
        } else {
            console.log(event.data.type);
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
