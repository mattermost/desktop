// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'renderer/css/index.css';

import React, {useEffect} from 'react';
import ReactDOM from 'react-dom';

import MainPage from './components/MainPage';
import {useConfig} from './hooks/useConfig';
import IntlProvider from './intl_provider';
import {printVersion} from './utils';

const openMenu = () => {
    if (window.process.platform !== 'darwin') {
        window.desktop.openAppMenu();
    }
};

function Root() {
    const {config} = useConfig();

    useEffect(() => {
        printVersion();

        // Deny drag&drop navigation in mainWindow.
        // Drag&drop is allowed in webview of index.html.
        document.addEventListener('dragover', (event) => event.preventDefault());
        document.addEventListener('drop', (event) => event.preventDefault());
    }, []);

    if (!config) {
        return null;
    }

    return (
        <IntlProvider>
            <MainPage
                openMenu={openMenu}
                darkMode={config.darkMode}
                appName={config.appName}
            />
        </IntlProvider>
    );
}

ReactDOM.render(
    <Root/>,
    document.getElementById('app'),
);
