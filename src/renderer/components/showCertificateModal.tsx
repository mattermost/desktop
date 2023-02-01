// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment} from 'react';
import {Modal, Button, Row, Col} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
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
                        <FormattedMessage
                            id='renderer.components.showCertificateModal.noCertSelected'
                            defaultMessage='No certificate Selected'
                        />
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
        const dateLocale = 'en-US'; // TODO: Translate?
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
                        {certificateSection(
                            <FormattedMessage
                                id='renderer.components.showCertificateModal.subjectName'
                                defaultMessage='Subject Name'
                            />,
                        )}
                        {certificateItem(
                            <FormattedMessage
                                id='renderer.components.showCertificateModal.commonName'
                                defaultMessage='Common Name'
                            />,
                            this.state.certificate?.subject.commonName,
                        )}
                    </dl>
                    <dl>
                        {certificateSection(
                            <FormattedMessage
                                id='renderer.components.showCertificateModal.issuerName'
                                defaultMessage='Issuer Name'
                            />,
                        )}
                        {certificateItem(
                            <FormattedMessage
                                id='renderer.components.showCertificateModal.commonName'
                                defaultMessage='Common Name'
                            />,
                            this.state.certificate?.issuer.commonName,
                        )}
                    </dl>
                    <dl>
                        {certificateItem(
                            <FormattedMessage
                                id='renderer.components.showCertificateModal.serialNumber'
                                defaultMessage='Serial Number'
                            />,
                            this.state.certificate?.serialNumber,
                        )}
                        {certificateItem(
                            <FormattedMessage
                                id='renderer.components.showCertificateModal.notValidBefore'
                                defaultMessage='Not Valid Before'
                            />,
                            creation.toLocaleString(dateLocale, dateDisplayOptions),
                        )}
                        {certificateItem(
                            <FormattedMessage
                                id='renderer.components.showCertificateModal.notValidAfter'
                                defaultMessage='Not Valid After'
                            />,
                            expiration.toLocaleString(dateLocale, dateDisplayOptions),
                        )}
                    </dl>
                    <dl>
                        {certificateSection(
                            <FormattedMessage
                                id='renderer.components.showCertificateModal.publicKeyInfo'
                                defaultMessage='Public Key Info'
                            />,
                        )}
                        {certificateItem(
                            <FormattedMessage
                                id='renderer.components.showCertificateModal.algorithm'
                                defaultMessage='Algorithm'
                            />,
                            this.state.certificate?.fingerprint.split('/')[0],
                        )}
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
                                >
                                    <FormattedMessage
                                        id='label.close'
                                        defaultMessage='Close'
                                    />
                                </Button>
                            </Col>
                        </Row>
                    </div>
                </Modal.Footer>
            </Modal>
        );
    }
}
