// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import type {UniqueServer} from 'types/config';

import ConfigureServer from '../../components/ConfigureServer';
import WelcomeScreen from '../../components/WelcomeScreen';

const MOBILE_SCREEN_WIDTH = 1200;

const onConnect = (data: UniqueServer) => {
    window.desktop.modals.finishModal(data);
};

const WelcomeScreenModalWrapper = () => {
    const [data, setData] = useState<{prefillURL?: string}>();
    const [darkMode, setDarkMode] = useState(false);
    const [getStarted, setGetStarted] = useState(false);
    const [mobileView, setMobileView] = useState(false);

    const handleWindowResize = () => {
        setMobileView(window.innerWidth < MOBILE_SCREEN_WIDTH);
    };

    useEffect(() => {
        window.desktop.getDarkMode().then((result) => {
            setDarkMode(result);
        });

        window.desktop.onDarkModeChange((result) => {
            setDarkMode(result);
        });

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
                    darkMode={darkMode}
                    onConnect={onConnect}
                    prefillURL={data?.prefillURL}
                />
            ) : (
                <WelcomeScreen
                    darkMode={darkMode}
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
