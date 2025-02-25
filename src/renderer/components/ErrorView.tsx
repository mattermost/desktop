// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ErrorCode: https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import AlertImage from './Images/alert';

import 'renderer/css/components/ErrorView.scss';

type ErrorViewProps = {
    darkMode: boolean;
    header: React.ReactNode;
    subHeader: React.ReactNode;
    bullets: React.ReactNode;
    contactAdmin: React.ReactNode;
    errorInfo?: string;
    url?: string;
    handleLink: () => void;
};

export default function ErrorView({
    darkMode,
    header,
    subHeader,
    bullets,
    contactAdmin,
    errorInfo,
    url,
    handleLink,
}: ErrorViewProps) {
    return (
        <div className={classNames('ErrorView', {darkMode})}>
            <AlertImage/>
            <span className='ErrorView-header'>
                {header}
            </span>
            <span>
                {subHeader}
            </span>
            <ul className='ErrorView-bullets'>
                {bullets}
                <li>
                    <FormattedMessage
                        id='renderer.components.errorView.troubleshooting.webContentsView.canReachFromBrowserWindow'
                        defaultMessage='Try opening <link>{url}</link> in a browser window.'
                        values={{
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
            </ul>
            <span>
                {contactAdmin}
            </span>
            <span className='ErrorView-techInfo'>
                {errorInfo}
            </span>
        </div>
    );
}
