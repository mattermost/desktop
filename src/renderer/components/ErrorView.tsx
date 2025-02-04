// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ErrorCode: https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import AlertImage from './Images/alert';

import 'renderer/css/components/ErrorView.scss';

type Props = {
    darkMode: boolean;
    errorInfo?: string;
    url?: string;
    appName?: string;
    handleLink: () => void;
};

export default function ErrorView(props: Props) {
    return (
        <div className={classNames('ErrorView', {darkMode: props.darkMode})}>
            <AlertImage/>
            <span className='ErrorView-header'>
                <FormattedMessage
                    id='renderer.components.errorView.cannotConnectToThisServer'
                    defaultMessage="Couldn't connect to this server"
                />
            </span>
            <span>
                <FormattedMessage
                    id='renderer.components.errorView.havingTroubleConnecting'
                    defaultMessage={'We\'re having trouble connecting to this {appName} server. We\'ll keep trying to establish a connection.'}
                    values={{
                        appName: props.appName,
                    }}
                />
                <br/>
                <FormattedMessage
                    id='renderer.components.errorView.refreshThenVerify'
                    defaultMessage="If refreshing this page (Ctrl+R or Command+R) doesn't help, please check the following:"
                />
            </span>
            <ul className='ErrorView-bullets'>
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
                            appName: props.appName,
                            url: props.url,
                            link: (msg: React.ReactNode) => (
                                <a
                                    onClick={props.handleLink}
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
                        id='renderer.components.errorView.troubleshooting.webContentsView.canReachFromBrowserWindow'
                        defaultMessage='Try opening <link>{url}</link> in a browser window.'
                        values={{
                            url: props.url,
                            link: (msg: React.ReactNode) => (
                                <a
                                    onClick={props.handleLink}
                                    href='#'
                                >
                                    {msg}
                                </a>
                            ),
                        }}
                    />
                </li>
            </ul>
            <span>
                <FormattedMessage
                    id='renderer.components.errorView.contactAdmin'
                    defaultMessage='If the issue persists, please contact your admin'
                />
            </span>
            <span className='ErrorView-techInfo'>
                {props.errorInfo}
            </span>
        </div>
    );
}
