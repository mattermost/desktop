// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Row, Button} from 'react-bootstrap';

type Props = {
    darkMode?: boolean;
    goBack?: () => void;
    show?: boolean;
};

export default class ExtraBar extends React.PureComponent<Props> {
    handleBack = () => {
        if (this.props.goBack) {
            this.props.goBack();
        }
    }
    render() {
        let barClass = 'clear-mode';
        if (!this.props.show) {
            barClass = 'hidden';
        } else if (this.props.darkMode) {
            barClass = 'dark-mode';
        }

        return (
            <Row
                id={'extra-bar'}
                className={barClass}
            >
                <div
                    className={'container-fluid'}
                    onClick={this.handleBack}
                >
                    <Button
                        variant={'link'}
                        size={'sm'}
                    >
                        <span className={'backIcon fa fa-1x fa-angle-left'}/>
                        <span className={'backLabel'}>
                            {'Back'}
                        </span>
                    </Button>
                </div>
            </Row>
        );
    }
}
