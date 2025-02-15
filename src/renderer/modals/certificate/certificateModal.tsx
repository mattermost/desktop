// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {Certificate} from 'electron/renderer';
import React, {Fragment} from 'react';
import {FormattedMessage} from 'react-intl';

import {Modal} from 'renderer/components/Modal';
import IntlProvider from 'renderer/intl_provider';

import ShowCertificateModal from '../../components/showCertificateModal';

import 'renderer/css/components/CertificateModal.scss';

type Props = {
    onSelect: (cert: Certificate) => void;
    onCancel: () => void;
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

        const footerContent = (
            <>
                <button
                    type='button'
                    disabled={this.state.selectedIndex === undefined}
                    onClick={this.handleCertificateInfo}
                    className={classNames('Modal__button btn btn-tertiary CertificateModal_certInfoButton', {
                        disabled: this.state.selectedIndex === undefined,
                    })}
                >
                    <FormattedMessage
                        id='renderer.modals.certificate.certificateModal.certInfoButton'
                        defaultMessage='Certificate Information'
                    />
                </button>
                <button
                    type='button'
                    className={classNames('Modal__button btn btn-tertiary')}
                    onClick={this.props.onCancel}
                >
                    <FormattedMessage
                        id='modal.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    type='submit'
                    className={classNames('Modal__button btn btn-primary confirm', {
                        disabled: this.state.selectedIndex === undefined,
                    })}
                    onClick={this.handleOk}
                    disabled={this.state.selectedIndex === undefined}
                >
                    <FormattedMessage
                        id='modal.confirm'
                        defaultMessage='Confirm'
                    />
                </button>
            </>
        );

        return (
            <IntlProvider>
                <Modal
                    id='selectCertificateModal'
                    className='CertificateModal'
                    show={Boolean(this.state.list && this.state.url)}
                    onExited={this.props.onCancel}
                    modalHeaderText={
                        <FormattedMessage
                            id='renderer.modals.certificate.certificateModal.title'
                            defaultMessage='Select a certificate'
                        />
                    }
                    modalSubheaderText={
                        <FormattedMessage
                            id='renderer.modals.certificate.certificateModal.subtitle'
                            defaultMessage='Select a certificate to authenticate yourself to {url}'
                            values={{url: this.state.url}}
                        />
                    }
                    footerContent={footerContent}
                >
                    <table
                        className='CertificateModal_list'
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
                        </tbody>
                    </table>
                </Modal>
            </IntlProvider>
        );
    }
}
