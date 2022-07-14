// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ErrorCode: https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h

import React from 'react';
import {Container, Row, Col} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

type Props = {
    errorInfo?: string;
    url?: string;
    id?: string;
    active?: boolean;
    appName?: string;
    handleLink: () => void;
};

export default function ErrorView(props: Props) {
    const classNames = ['container', 'ErrorView'];
    if (!props.active) {
        classNames.push('ErrorView-hidden');
    }

    return (
        <Container
            id={props.id}
        >
            <div className='ErrorView-table'>
                <div className='ErrorView-cell'>
                    <Row>
                        <Col
                            xs={0}
                            sm={1}
                            md={1}
                            lg={2}
                        />
                        <Col
                            xs={12}
                            sm={10}
                            md={10}
                            lg={8}
                        >
                            <h2>
                                <FormattedMessage
                                    id='renderer.components.errorView.cannotConnectToAppName'
                                    defaultMessage='Cannot connect to {appName}'
                                    values={{
                                        appName: props.appName,
                                    }}
                                />
                            </h2>
                            <hr/>
                            <p>
                                <FormattedMessage
                                    id='renderer.components.errorView.havingTroubleConnecting'
                                    defaultMessage={'We\'re having trouble connecting to {appName}. We\'ll continue to try and establish a connection.'}
                                    values={{
                                        appName: props.appName,
                                    }}
                                />
                                <br/>
                                <FormattedMessage
                                    id='renderer.components.errorView.refreshThenVerify'
                                    defaultMessage='If refreshing this page (Ctrl+R or Command+R) does not work please verify that:'
                                />
                            </p>
                            <ul className='ErrorView-bullets' >
                                <li>
                                    <FormattedMessage
                                        id='renderer.components.errorView.troubleshooting.computerIsConnected'
                                        defaultMessage='Your computer is connected to the internet.'
                                    />
                                </li>
                                <li>
                                    <FormattedMessage
                                        id='renderer.components.errorView.troubleshooting.urlIsCorrect.appNameIsCorrect'
                                        defaultMessage='The {appName} URL <link>{url}</link> is correct'
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
                                        id='renderer.components.errorView.troubleshooting.browserView.canReachFromBrowserWindow'
                                        defaultMessage='You can reach <link>{url}</link> from a browser window.'
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
                            <br/>
                            <div className='ErrorView-techInfo'>
                                {props.errorInfo}
                            </div>
                        </Col>
                        <Col
                            xs={0}
                            sm={1}
                            md={1}
                            lg={2}
                        />
                    </Row>
                </div>
            </div>
        </Container>
    );
}
