// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ErrorCode: https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h

import React from 'react';
import {Container, Row, Col} from 'react-bootstrap';

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
                            <h2>{`Cannot connect to ${props.appName}`}</h2>
                            <hr/>
                            <p>
                                {`We're having trouble connecting to ${props.appName}. We'll continue to try and establish a connection.`}
                                <br/>
                                {'If refreshing this page (Ctrl+R or Command+R) does not work please verify that:'}
                            </p>
                            <ul className='ErrorView-bullets' >
                                <li>{'Your computer is connected to the internet.'}</li>
                                <li>{`The ${props.appName} URL `}
                                    <a

                                        onClick={props.handleLink}
                                        href='#'
                                    >
                                        {props.url}
                                    </a>{' is correct.'}</li>
                                <li>{'You can reach '}
                                    <a

                                        onClick={props.handleLink}
                                        href='#'
                                    >
                                        {props.url}
                                    </a>{' from a browser window.'}</li>
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
