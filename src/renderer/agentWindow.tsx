// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'renderer/css/index.scss';
import 'renderer/css/agentWindow.scss';

import React from 'react';
import ReactDOM from 'react-dom';

import AgentPrompt from './components/AgentPrompt';
import IntlProvider from './intl_provider';
import setupDarkMode from './modals/darkMode';

setupDarkMode();

function AgentWindow() {
    return (
        <IntlProvider>
            <AgentPrompt/>
        </IntlProvider>
    );
}

ReactDOM.render(
    <AgentWindow/>,
    document.getElementById('app'),
);
