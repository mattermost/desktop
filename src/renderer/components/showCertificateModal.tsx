// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment} from 'react';
import {Modal, Button, Row, Col} from 'react-bootstrap';
import {Certificate} from 'electron/renderer';

type Props = {
    certificate: Certificate;
    onOk: () => void;
};

type State = {
    certificate?: Certificate;
}

export default class ShowCertificateModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            certificate: props.certificate,
        };
    }

    handleOk = () => {
        this.setState({certificate: undefined});
        this.props.onOk();
    }

    render() {
        const certificateSection = (descriptor: React.ReactNode) => {
            return (
                <Fragment>
                    <dt className={'certificate-key'}>{descriptor}</dt>
                    <dd className={'certificate-section'}><span/></dd>
                </Fragment>
            );
        };
        const certificateItem = (descriptor: React.ReactNode, value: React.ReactNode) => {
            const val = value ? `${value}` : <span/>;
            return (
                <Fragment>
                    <dt className={'certificate-key'}>{descriptor}</dt>
                    <dd className={'certificate-value'}>{val}</dd>
                </Fragment>
            );
        };

        if (this.state.certificate === null) {
            return (
                <Modal
                    bsClass='modal'
                    className='show-certificate'
                    onHide={() => {}}
                >
                    <Modal.Body>
                        {'No certificate Selected'}
                    </Modal.Body>
                </Modal>
            );
        }

        const utcSeconds = (date: number) => {
            const d = new Date(0);
            d.setUTCSeconds(date);
            return d;
        };

        const expiration = utcSeconds(this.state.certificate?.validExpiry || 0);
        const creation = utcSeconds(this.state.certificate?.validStart || 0);
        const dateDisplayOptions = {dateStyle: 'full' as const, timeStyle: 'full' as const};
        const dateLocale = 'en-US';
        return (
            <Modal
                bsClass='modal'
                className='show-certificate'
                show={this.state.certificate !== null}
                onHide={() => {}}
            >
                <Modal.Header className={'no-border'}>
                    <Modal.Title>{'Certificate information'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className='details'>{'Details'}</p>
                    <dl>
                        {certificateSection('Subject Name')}
                        {certificateItem('Common Name', this.state.certificate?.subject.commonName)}
                    </dl>
                    <dl>
                        {certificateSection('Issuer Name')}
                        {certificateItem('Common Name', this.state.certificate?.issuer.commonName)}
                    </dl>
                    <dl>
                        {certificateItem('Serial Number', this.state.certificate?.serialNumber)}
                        {certificateItem('Not Valid Before', creation.toLocaleString(dateLocale, dateDisplayOptions))}
                        {certificateItem('Not Valid After', expiration.toLocaleString(dateLocale, dateDisplayOptions))}
                    </dl>
                    <dl>
                        {certificateSection('Public Key Info')}
                        {certificateItem('Algorithm', this.state.certificate?.fingerprint.split('/')[0])}
                    </dl>
                </Modal.Body>
                <Modal.Footer className={'no-border'}>
                    <div className='container-fluid'>
                        <Row>
                            <Col>
                                <Button
                                    variant='primary'
                                    onClick={this.handleOk}
                                    className={'primary'}
                                >{'Close'}</Button>
                            </Col>
                        </Row>
                    </div>
                </Modal.Footer>
            </Modal>
        );
    }
}
