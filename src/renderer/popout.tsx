// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'renderer/css/index.scss';

import React, {useCallback, useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import BasePage, {ErrorState} from './components/BasePage';
import {useConfig} from './hooks/useConfig';
import IntlProvider from './intl_provider';
import setupDarkMode from './modals/darkMode';
import {printVersion} from './utils';

setupDarkMode();

function Popout() {
    const {config} = useConfig();
    const [errorState, setErrorState] = useState<ErrorState | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [errorUrl, setErrorUrl] = useState<string | undefined>(undefined);
    const [title, setTitle] = useState<string | undefined>(undefined);
    const [viewId, setViewId] = useState<string | undefined>(undefined);

    useEffect(() => {
        printVersion();

        // Deny drag&drop navigation in mainWindow.
        // Drag&drop is allowed in webview of index.html.
        document.addEventListener('dragover', (event) => event.preventDefault());
        document.addEventListener('drop', (event) => event.preventDefault());

        window.desktop.onLoadFailed((_, err, loadUrl) => {
            setErrorState(ErrorState.FAILED);
            setErrorMessage(err);
            setErrorUrl(loadUrl);
        });

        window.desktop.onLoadIncompatibleServer((_, loadUrl) => {
            setErrorState(ErrorState.INCOMPATIBLE);
            setErrorUrl(loadUrl);
        });

        window.desktop.onUpdatePopoutTitle((viewId, title) => {
            setTitle(title);
            setViewId(viewId);
        });
    }, []);

    const openPopoutMenu = useCallback(() => {
        if (!viewId) {
            return;
        }
        window.desktop.openPopoutMenu(viewId);
    }, [viewId]);

    const openMenu = useCallback(() => {
        if (window.process.platform !== 'darwin') {
            openPopoutMenu();
        }
    }, [openPopoutMenu]);

    if (!config) {
        return null;
    }

    return (
        <IntlProvider>
            <BasePage
                openMenu={openMenu}
                openPopoutMenu={openPopoutMenu}
                title={title ?? config.appName}
                appName={config.appName}
                errorState={errorState}
                errorMessage={errorMessage}
                errorUrl={errorUrl}
            />
        </IntlProvider>
    );
}

ReactDOM.render(
    <Popout/>,
    document.getElementById('app'),
);
