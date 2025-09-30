// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import ReactDOM from 'react-dom';

import setupDarkMode from 'renderer/modals/darkMode';

import LoadingScreen from '../../components/LoadingScreen';

const onFadeOutComplete = () => {
    window.desktop.loadingScreen.loadingScreenAnimationFinished();
};

const closeDropdowns = () => {
    window.desktop.closeServersDropdown();
    window.desktop.closeDownloadsDropdown();
};

setupDarkMode();

const LoadingScreenRoot: React.FC = () => {
    const [showLoadingScreen, setShowLoadingScreen] = useState(true);

    useEffect(() => {
        const handleToggleLoadingScreenVisibility = (showLoadingScreen: boolean) => {
            setShowLoadingScreen(showLoadingScreen);
        };

        const initializeApp = async () => {
            window.desktop.loadingScreen.onToggleLoadingScreenVisibility(handleToggleLoadingScreenVisibility);
            window.addEventListener('click', closeDropdowns);
        };

        initializeApp();

        // Cleanup function
        return () => {
            // Note: In a real app, you might want to remove event listeners here
            // but since this is a root component that doesn't unmount, it's not strictly necessary
        };
    }, []);

    return (
        <LoadingScreen
            loading={showLoadingScreen}
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
