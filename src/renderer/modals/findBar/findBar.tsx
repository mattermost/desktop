// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import FindBar from 'renderer/components/FindBar';
import IntlProvider from 'renderer/intl_provider';

import setupDarkMode from '../darkMode';

setupDarkMode();

const FindBarWrapper: React.FC = () => {
    return (
        <IntlProvider>
            <FindBar/>
        </IntlProvider>
    );
};

ReactDOM.render(
    <FindBarWrapper/>,
    document.getElementById('app'),
);
