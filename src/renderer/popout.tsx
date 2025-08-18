// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import 'renderer/css/index.css';

import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import BasePage, {ErrorState} from './components/BasePage';
import {useConfig} from './hooks/useConfig';
import IntlProvider from './intl_provider';

function Popout() {
    const {config} = useConfig();
    const [errorState, setErrorState] = useState<ErrorState | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [errorUrl, setErrorUrl] = useState<string | undefined>(undefined);
    const [title, setTitle] = useState<string | undefined>(undefined);
    const [viewId, setViewId] = useState<string | undefined>(undefined);

    useEffect(() => {
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

        window.desktop.onUpdateTabTitle((viewId, title) => {
            setTitle(title);
            setViewId(viewId);
        });
    }, []);

    const openMenu = () => {
        if (window.process.platform !== 'darwin') {
            window.desktop.openAppMenu();
        }
    };

    const openPopoutMenu = () => {
        if (!viewId) {
            return;
        }
        window.desktop.openPopoutMenu(viewId);
    };

    if (!config) {
        return null;
    }

    return (
        <IntlProvider>
            <BasePage
                openMenu={openMenu}
                openPopoutMenu={openPopoutMenu}
                darkMode={config.darkMode}
                title={title ?? config.appName}
                appName={config.appName}
                errorState={errorState}
                errorMessage={errorMessage}
                errorUrl={errorUrl}
            />
        </IntlProvider>
    );
}

window.desktop.getVersion().then(({name, version}) => {
    // eslint-disable-next-line no-undef
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    console.log(`Starting ${name} v${version}${__HASH_VERSION__ ? ` commit: ${__HASH_VERSION__}` : ''}`);
});

ReactDOM.render(
    <Popout/>,
    document.getElementById('app'),
);
