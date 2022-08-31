// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import {TeamWithIndex} from 'types/config';
import {ModalMessage} from 'types/modals';

import {
    MODAL_RESULT,
    GET_MODAL_UNCLOSEABLE,
    GET_DARK_MODE,
    DARK_MODE_CHANGE,
    RESIZE_MODAL,
    MODAL_INFO,
} from 'common/communication';
import IntlProvider from 'renderer/intl_provider';
import ConfigureServer from '../../components/ConfigureServer';

import 'bootstrap/dist/css/bootstrap.min.css';

const MOBILE_SCREEN_WIDTH = 1200;

const onConnect = (data: TeamWithIndex) => {
    window.postMessage({type: MODAL_RESULT, data}, window.location.href);
};

const ConfigureServerModalWrapper = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [mobileView, setMobileView] = useState(false);
    const [currentTeams, setCurrentTeams] = useState<TeamWithIndex[]>([]);

    useEffect(() => {
        setMobileView(window.innerWidth < MOBILE_SCREEN_WIDTH);
        window.postMessage({type: GET_MODAL_UNCLOSEABLE}, window.location.href);
        window.postMessage({type: GET_DARK_MODE}, window.location.href);
        window.addEventListener('message', handleMessageEvent);

        return () => {
            window.removeEventListener('message', handleMessageEvent);
        };
    }, []);

    const handleMessageEvent = (event: {data: ModalMessage<boolean | Electron.Rectangle | TeamWithIndex[]>}) => {
        switch (event.data.type) {
        case DARK_MODE_CHANGE:
            setDarkMode(event.data.data as boolean);
            break;
        case RESIZE_MODAL: {
            const {width} = event.data.data as Electron.Rectangle;

            setMobileView(width < MOBILE_SCREEN_WIDTH);
            break;
        }
        case MODAL_INFO:
            setCurrentTeams(event.data.data as TeamWithIndex[]);
            break;
        default:
            break;
        }
    };

    return (
        <IntlProvider>
            <ConfigureServer
                mobileView={mobileView}
                darkMode={darkMode}
                currentTeams={currentTeams}
                onConnect={onConnect}
            />
        </IntlProvider>
    );
};

const start = async () => {
    ReactDOM.render(
        <ConfigureServerModalWrapper/>,
        document.getElementById('app'),
    );
};

start();
