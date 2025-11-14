// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';
import setupDarkMode from 'renderer/modals/darkMode';

import type {UniqueServer} from 'types/config';

import ConfigureServer from '../../components/ConfigureServer';
import WelcomeScreen from '../../components/WelcomeScreen';

const MOBILE_SCREEN_WIDTH = 1200;

const onConnect = (data: UniqueServer) => {
    window.desktop.modals.finishModal(data);
};

setupDarkMode();

const WelcomeScreenModalWrapper = () => {
    const [data, setData] = useState<{prefillURL?: string}>();
    const [getStarted, setGetStarted] = useState(false);
    const [mobileView, setMobileView] = useState(false);

    const handleWindowResize = () => {
        setMobileView(window.innerWidth < MOBILE_SCREEN_WIDTH);
    };

    useEffect(() => {
        window.desktop.modals.getModalInfo<{prefillURL?: string}>().
            then((data) => {
                setData(data);
                if (data.prefillURL) {
                    setGetStarted(true);
                }
            });

        handleWindowResize();
        window.addEventListener('resize', handleWindowResize);

        return () => {
            window.removeEventListener('resize', handleWindowResize);
        };
    }, []);

    const onGetStarted = () => {
        setGetStarted(true);
    };

    return (
        <IntlProvider>
            {getStarted ? (
                <ConfigureServer
                    mobileView={mobileView}
                    onConnect={onConnect}
                    prefillURL={data?.prefillURL}
                />
            ) : (
                <WelcomeScreen
                    onGetStarted={onGetStarted}
                />
            )}
        </IntlProvider>
    );
};

const start = () => {
    ReactDOM.render(
        <WelcomeScreenModalWrapper/>,
        document.getElementById('app'),
    );
};

start();
