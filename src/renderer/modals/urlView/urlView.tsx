// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import UrlView from 'renderer/components/UrlView';
import setupDarkMode from 'renderer/modals/darkMode';

setupDarkMode();

const start = async () => {
    ReactDOM.render(
        <UrlView/>,
        document.getElementById('app'),
    );
};

start();
