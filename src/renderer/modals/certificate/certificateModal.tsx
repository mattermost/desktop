// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Certificate} from 'electron/renderer';
import React, {Fragment} from 'react';
import {Modal, Button, Table, Row, Col} from 'react-bootstrap';

import {CertificateModalData} from 'types/certificate';
import {ModalMessage} from 'types/modals';

import {MODAL_INFO} from 'common/communication';

import ShowCertificateModal from '../../components/showCertificateModal';

type Props = {
    onSelect: (cert: Certificate) => void;
    onCancel?: () => void;
    getCertInfo: () => void;
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

    componentDidMount() {
        window.addEventListener('message', this.handleCertInfoMessage);

        this.props.getCertInfo();
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.handleCertInfoMessage);
    }

    handleCertInfoMessage = (event: {data: ModalMessage<CertificateModalData>}) => {
        switch (event.data.type) {
        case MODAL_INFO: {
            const {url, list} = event.data.data;
            this.setState({url, list});
            break;
        }
        default:
            break;
        }
    }

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
        return (<Fragment><tr/><tr><td/><td>{'No certificates available'}</td><td/></tr></Fragment>);
    }

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
    }

    handleCertificateInfo = () => {
        const certificate = this.getSelectedCert();
        this.setState({showCertificate: certificate});
    }

    certificateInfoClose = () => {
        this.setState({showCertificate: undefined});
    }

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
            <Modal
                bsClass='modal'
                className='certificate-modal'
                show={Boolean(this.state.list && this.state.url)}
                onHide={() => {}}
            >
                <Modal.Header>
                    <Modal.Title >{'Select a certificate'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className={'subtitle'}>{`Select a certificate to authenticate yourself to ${this.state.url}`}</p>
                    <Table
                        striped={true}
                        hover={true}
                        responsive={true}
                        className='certificate-list'
                        tabIndex={1}
                    >
                        <thead>
                            <tr>
                                <th><span className={'divider'}>{'Subject'}</span></th>
                                <th><span className={'divider'}>{'Issuer'}</span></th>
                                <th>{'Serial'}</th>
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
                                >{'Certificate Information'}</Button>
                            </Col>
                            <Col sm={8}>
                                <Button
                                    variant='link'
                                    onClick={this.props.onCancel}
                                    className={'secondary'}
                                >{'Cancel'}</Button>
                                <Button
                                    variant='primary'
                                    onClick={this.handleOk}
                                    disabled={this.state.selectedIndex === null}
                                    className={'primary'}
                                >{'OK'}</Button>
                            </Col>
                        </Row>
                    </div>
                </Modal.Footer>
            </Modal>
        );
    }
}
