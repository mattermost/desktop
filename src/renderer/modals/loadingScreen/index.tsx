// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import LoadingScreen from '../../components/LoadingScreen';

import 'renderer/css/components/LoadingAnimation.css';
import 'renderer/css/components/LoadingScreen.css';

type Props = Record<string, never>;

type State = {
    showLoadingScreen: boolean;
    darkMode: boolean;
}

class LoadingScreenRoot extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            showLoadingScreen: true,
            darkMode: false,
        };
    }

    async componentDidMount() {
        window.desktop.onDarkModeChange(this.setDarkMode);
        const darkMode = await window.desktop.getDarkMode();
        this.setDarkMode(darkMode);

        window.desktop.loadingScreen.onToggleLoadingScreenVisibility(this.onToggleLoadingScreenVisibility);

        window.addEventListener('click', () => {
            window.desktop.closeServersDropdown();
            window.desktop.closeDownloadsDropdown();
        });
    }

    setDarkMode = (darkMode: boolean) => {
        this.setState({darkMode});
    };

    onToggleLoadingScreenVisibility = (showLoadingScreen: boolean) => {
        this.setState({showLoadingScreen});
    };

    onFadeOutComplete = () => {
        window.desktop.loadingScreen.loadingScreenAnimationFinished();
    };

    render() {
        return (
            <LoadingScreen
                loading={this.state.showLoadingScreen}
                darkMode={this.state.darkMode}
                onFadeOutComplete={this.onFadeOutComplete}
            />
        );
    }
}
const start = async () => {
    ReactDOM.render(
        <LoadingScreenRoot/>,
        document.getElementById('app'),
    );
};

start();
