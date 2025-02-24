// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ErrorView from './ErrorView';

type Props = {
    darkMode: boolean;
    appName?: string;
    url?: string;
    handleLink: () => void;
    handleUpgradeLink: () => void;
};

export default function IncompatibleErrorView({darkMode, appName, url, handleLink, handleUpgradeLink}: Props) {
    const header = (
        <FormattedMessage
            id='renderer.components.errorView.incompatibleServerVersion'
            defaultMessage='Incompatible server version'
        />
    );

    const subHeader = (
        <>
            <FormattedMessage
                id='renderer.components.errorView.serverVersionIsIncompatible'
                defaultMessage={'The {appName} Server you are accessing is incompatible with this version of the {appName} Desktop App. To connect to this server, please try the following:'}
                values={{
                    appName,
                }}
            />
        </>
    );

    const bullets = (
        <>
            <li>
                <FormattedMessage
                    id='renderer.components.errorView.troubleshooting.downgradeApp'
                    defaultMessage='<link>Downgrade your {appName} Desktop App</link> to version v5.10 or earlier.'
                    values={{
                        appName,
                        link: (msg: React.ReactNode) => (
                            <a
                                href='#'
                                onClick={handleUpgradeLink}
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
            id='renderer.components.errorView.contactAdminUpgrade'
            defaultMessage='If the issue persists, contact your {appName} Administrator or IT department to upgrade this {appName} Server.'
            values={{
                appName,
            }}
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
            url={url}
        />
    );
}
