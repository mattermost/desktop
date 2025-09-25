// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import ErrorView from './ErrorView';

type Props = {
    darkMode: boolean;
    appName?: string;
    url?: string;
    errorInfo?: string;
    handleLink: () => void;
};

export default function ConnectionErrorView({darkMode, appName, url, handleLink, errorInfo}: Props) {
    const clearCacheAndReload = useCallback(() => {
        window.desktop.clearCacheAndReload();
    }, []);
    const header = (
        <FormattedMessage
            id='renderer.components.errorView.cannotConnectToThisServer'
            defaultMessage="Couldn't connect to this server"
        />
    );

    const subHeader = (
        <>
            <FormattedMessage
                id='renderer.components.errorView.havingTroubleConnecting'
                defaultMessage={'We\'re having trouble connecting to this {appName} server. We\'ll keep trying to establish a connection.'}
                values={{
                    appName,
                }}
            />
            <br/>
            <FormattedMessage
                id='renderer.components.errorView.tryTheseSteps'
                defaultMessage='Please try the following steps if this issue persists:'
            />
        </>
    );

    const bullets = (
        <>
            <li>
                <FormattedMessage
                    id='renderer.components.errorView.troubleshooting.clearCacheAndReload'
                    defaultMessage='Try to <link>clear the cache and reload</link>. This may fix the issue.'
                    values={{
                        link: (msg: React.ReactNode) => (
                            <a
                                onClick={clearCacheAndReload}
                                href='#'
                            >
                                {msg}
                            </a>
                        ),
                    }}
                />
            </li>
            <li>
                <FormattedMessage
                    id='renderer.components.errorView.troubleshooting.ensureComputerIsConnected'
                    defaultMessage='Ensure your computer is connected to your network.'
                />
            </li>
            <li>
                <FormattedMessage
                    id='renderer.components.errorView.troubleshooting.urlIsCorrect.appNameIsCorrect'
                    defaultMessage='Verify that the URL <link>{url}</link> is correct.'
                    values={{
                        appName,
                        url,
                        link: (msg: React.ReactNode) => (
                            <a
                                onClick={handleLink}
                                href='#'
                            >
                                {msg}
                            </a>
                        ),
                    }}
                />
            </li>
        </>
    );

    const contactAdmin = (
        <FormattedMessage
            id='renderer.components.errorView.contactAdmin'
            defaultMessage='If the issue persists, please contact your admin.'
        />
    );

    return (
        <ErrorView
            darkMode={darkMode}
            header={header}
            subHeader={subHeader}
            bullets={bullets}
            contactAdmin={contactAdmin}
            handleLink={handleLink}
            errorInfo={errorInfo}
            url={url}
        />
    );
}
