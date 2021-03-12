// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {RECEIVED_LOADING_SCREEN_DATA, GET_LOADING_SCREEN_DATA, LOADING_SCREEN_ANIMATION_FINISHED, TOGGLE_LOADING_SCREEN_VISIBILITY} from 'common/communication.js';

import LoadingScreen from '../../components/LoadingScreen.jsx';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';
import 'renderer/css/components/LoadingAnimation.css';
import 'renderer/css/components/LoadingScreen.css';

class LoadingScreenRoot extends React.PureComponent {
    constructor() {
        super();
        this.state = {
            showLoadingScreen: true,
            darkMode: false,
        };
    }

    componentDidMount() {
        window.postMessage({type: GET_LOADING_SCREEN_DATA}, window.location.href);

        window.addEventListener('message', this.handleMessageEvent);
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.handleMessageEvent);
    }

    handleMessageEvent = (event) => {
        if (event.data.type === RECEIVED_LOADING_SCREEN_DATA) {
            this.setState({
                darkMode: event.data.data.darkMode,
            });
        }

        if (event.data.type === TOGGLE_LOADING_SCREEN_VISIBILITY) {
            this.setState({
                showLoadingScreen: event.data.data,
            });
        }
    }

    onFadeOutComplete = () => {
        window.postMessage({type: LOADING_SCREEN_ANIMATION_FINISHED}, window.location.href);
    }

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
