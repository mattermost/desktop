// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ErrorView from 'renderer/components/ErrorView';

type Props = {
    appName?: string;
};

export default function InvalidSiteURLErrorView({appName}: Props) {
    const header = (
        <FormattedMessage
            id='renderer.components.errorView.invalidSiteURL'
            defaultMessage='Server configuration issue'
        />
    );

    const subHeader = (
        <>
            <FormattedMessage
                id='renderer.components.errorView.siteURLIsInvalid'
                defaultMessage={'The Site URL configured on this {appName} server is not a valid URL, so the server cannot be loaded.'}
                values={{
                    appName,
                }}
            />
            <br/>
            <FormattedMessage
                id='renderer.components.errorView.askAdminToSetSiteURL'
                defaultMessage='Please ask your administrator to set a valid Site URL in the System Console, under Environment > Web Server.'
            />
        </>
    );

    return (
        <ErrorView
            header={header}
            subHeader={subHeader}
            showOpenInBrowser={false}
        />
    );
}
