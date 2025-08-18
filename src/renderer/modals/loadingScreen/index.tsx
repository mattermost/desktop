// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import ReactDOM from 'react-dom';

import {useConfig} from 'renderer/hooks/useConfig';

import LoadingScreen from '../../components/LoadingScreen';

import 'renderer/css/components/LoadingAnimation.css';
import 'renderer/css/components/LoadingScreen.css';

const LoadingScreenRoot: React.FC = () => {
    const [showLoadingScreen, setShowLoadingScreen] = useState(true);
    const {config} = useConfig();

    useEffect(() => {
        const handleToggleLoadingScreenVisibility = (showLoadingScreen: boolean) => {
            setShowLoadingScreen(showLoadingScreen);
        };

        const initializeApp = async () => {
            window.desktop.loadingScreen.onToggleLoadingScreenVisibility(handleToggleLoadingScreenVisibility);

            window.addEventListener('click', () => {
                window.desktop.closeServersDropdown();
                window.desktop.closeDownloadsDropdown();
            });
        };

        initializeApp();

        // Cleanup function
        return () => {
            // Note: In a real app, you might want to remove event listeners here
            // but since this is a root component that doesn't unmount, it's not strictly necessary
        };
    }, []);

    const onFadeOutComplete = () => {
        window.desktop.loadingScreen.loadingScreenAnimationFinished();
    };

    if (!config) {
        return null;
    }

    return (
        <LoadingScreen
            loading={showLoadingScreen}
            darkMode={config.darkMode}
            onFadeOutComplete={onFadeOutComplete}
        />
    );
};

const start = async () => {
    ReactDOM.render(
        <LoadingScreenRoot/>,
        document.getElementById('app'),
    );
};

start();
