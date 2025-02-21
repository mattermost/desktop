// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
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
                id='renderer.components.errorView.refreshThenVerify'
                defaultMessage="If refreshing this page (Ctrl+R or Command+R) doesn't help, please check the following:"
            />
        </>
    );

    const bullets = (
        <>
            <li>
                <FormattedMessage
                    id='renderer.components.errorView.troubleshooting.computerIsConnected'
                    defaultMessage='Ensure your computer is connected to the internet.'
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
            defaultMessage='If the issue persists, please contact your admin'
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
