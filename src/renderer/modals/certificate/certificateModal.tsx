// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Certificate} from 'electron/renderer';
import React, {Fragment} from 'react';
import {Modal, Button, Table, Row, Col} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import IntlProvider from 'renderer/intl_provider';

import ShowCertificateModal from '../../components/showCertificateModal';

type Props = {
    onSelect: (cert: Certificate) => void;
    onCancel?: () => void;
    getCertInfo: () => Promise<{url: string; list: Certificate[]}>;
}

type State = {
    selectedIndex?: number;
    showCertificate?: Certificate;
    url?: string;
    list?: Certificate[];
}

export default class SelectCertificateModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {};
    }

    async componentDidMount() {
        await this.getCertInfo();
    }

    getCertInfo = async () => {
        const {url, list} = await this.props.getCertInfo();
        this.setState({url, list});
    };

    selectfn = (index: number) => {
        return (() => {
            this.setState({selectedIndex: index});
        });
    };

    renderCert = (cert: Certificate, index: number) => {
        const issuer = (cert.issuerName || (cert.issuer && cert.issuer.commonName) || '');
        const subject = (cert.subjectName || (cert.subject && cert.subject.commonName) || '');
        const serial = cert.serialNumber || '';

        return (
            <tr
                key={`cert-${index}`}
                onClick={this.selectfn(index)}
                className={this.state.selectedIndex === index ? 'selected' : ''}
            >
                <td
                    title={subject}
                >{subject}</td>
                <td
                    title={issuer}
                >{issuer}</td>
                <td
                    title={serial}
                >{serial}</td>
            </tr>);
    };

    renderCerts = (certificateList: Certificate[]) => {
        if (certificateList) {
            const certs = certificateList.map(this.renderCert);
            return (
                <Fragment>
                    {certs}
                </Fragment>
            );
        }
        return (<Fragment><tr/><tr><td/><td>
            <FormattedMessage
                id='renderer.modals.certificate.certificateModal.noCertsAvailable'
                defaultMessage='No certificates available'
            />
        </td><td/></tr></Fragment>);
    };

    getSelectedCert = () => {
        if (this.state.list && this.state.selectedIndex !== undefined) {
            return this.state.list[this.state.selectedIndex];
        }
        return undefined;
    };

    handleOk = () => {
        const cert = this.getSelectedCert();
        if (cert) {
            this.props.onSelect(cert);
        }
    };

    handleCertificateInfo = () => {
        const certificate = this.getSelectedCert();
        this.setState({showCertificate: certificate});
    };

    certificateInfoClose = () => {
        this.setState({showCertificate: undefined});
    };

    render() {
        if (this.state.showCertificate) {
            return (
                <ShowCertificateModal
                    certificate={this.state.showCertificate}
                    onOk={this.certificateInfoClose}
                />
            );
        }

        return (
            <IntlProvider>
                <Modal
                    bsClass='modal'
                    className='certificate-modal'
                    show={Boolean(this.state.list && this.state.url)}
                    onHide={() => {}}
                >
                    <Modal.Header>
                        <Modal.Title>
                            <FormattedMessage
                                id='renderer.modals.certificate.certificateModal.title'
                                defaultMessage='Select a certificate'
                            />
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p className={'subtitle'}>
                            <FormattedMessage
                                id='renderer.modals.certificate.certificateModal.subtitle'
                                defaultMessage='Select a certificate to authenticate yourself to {url}'
                                values={{url: this.state.url}}
                            />
                        </p>
                        <Table
                            striped={true}
                            hover={true}
                            responsive={true}
                            className='certificate-list'
                            tabIndex={1}
                        >
                            <thead>
                                <tr>
                                    <th><span className={'divider'}>
                                        <FormattedMessage
                                            id='renderer.modals.certificate.certificateModal.subject'
                                            defaultMessage='Subject'
                                        />
                                    </span></th>
                                    <th><span className={'divider'}>
                                        <FormattedMessage
                                            id='renderer.modals.certificate.certificateModal.issuer'
                                            defaultMessage='Issuer'
                                        />
                                    </span></th>
                                    <th>
                                        <FormattedMessage
                                            id='renderer.modals.certificate.certificateModal.serial'
                                            defaultMessage='Serial'
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {this.renderCerts(this.state.list!)}
                                <tr/* this is to correct table height without affecting real rows *//>
                            </tbody>
                        </Table>
                    </Modal.Body>
                    <Modal.Footer className={'no-border'}>
                        <div className={'container-fluid'}>
                            <Row>
                                <Col sm={4}>
                                    <Button
                                        variant='info'
                                        disabled={this.state.selectedIndex === null}
                                        onClick={this.handleCertificateInfo}
                                        className={'info'}
                                    >
                                        <FormattedMessage
                                            id='renderer.modals.certificate.certificateModal.certInfoButton'
                                            defaultMessage='Certificate Information'
                                        />
                                    </Button>
                                </Col>
                                <Col sm={8}>
                                    <Button
                                        variant='link'
                                        onClick={this.props.onCancel}
                                        className={'secondary'}
                                    >
                                        <FormattedMessage
                                            id='label.cancel'
                                            defaultMessage='Cancel'
                                        />
                                    </Button>
                                    <Button
                                        variant='primary'
                                        onClick={this.handleOk}
                                        disabled={this.state.selectedIndex === null}
                                        className={'primary'}
                                    >
                                        <FormattedMessage
                                            id='label.ok'
                                            defaultMessage='OK'
                                        />
                                    </Button>
                                </Col>
                            </Row>
                        </div>
                    </Modal.Footer>
                </Modal>
            </IntlProvider>
        );
    }
}
