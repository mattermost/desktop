// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import 'renderer/css/components/LoadingSpinner.scss';

type Props = {
    text: React.ReactNode;
}

export default class LoadingSpinner extends React.PureComponent<Props> {
    public static defaultProps: Props = {
        text: null,
    };

    public render() {
        return (
            <span
                id='loadingSpinner'
                className={'LoadingSpinner' + (this.props.text ? ' with-text' : '')}
            >
                <span className='spinner'/>
                {this.props.text}
            </span>
        );
    }
}
