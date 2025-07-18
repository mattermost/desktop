// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Certificate} from 'electron/renderer';
import React, {Fragment} from 'react';
import {FormattedMessage} from 'react-intl';

import {Modal} from 'renderer/components/Modal';
import IntlProvider from 'renderer/intl_provider';

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
    };

    render() {
        const certificateSection = (descriptor: React.ReactNode) => {
            return (
                <Fragment>
                    <dt className={'certificate-key'}><strong>{descriptor}</strong></dt>
                    <dd className={'certificate-section'}><span/></dd>
                </Fragment>
            );
        };
        const certificateItem = (descriptor: React.ReactNode, value: React.ReactNode) => {
            const val = value ? `${value}` : <span/>;
            return (
                <Fragment>
                    <dt className={'certificate-key'}><strong>{descriptor}</strong></dt>
                    <dd className={'certificate-value'}>{val}</dd>
                </Fragment>
            );
        };

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
            <IntlProvider>
                <Modal
                    id='showCertificateModal'
                    show={this.state.certificate !== null}
                    onExited={this.handleOk}
                    modalHeaderText={
                        <FormattedMessage
                            id='renderer.components.showCertificateModal.title'
                            defaultMessage='Certificate information'
                        />
                    }
                    confirmButtonText={
                        <FormattedMessage
                            id='label.close'
                            defaultMessage='Close'
                        />
                    }
                    handleConfirm={this.handleOk}
                    handleEnterKeyPress={this.handleOk}
                >
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
                </Modal>
            </IntlProvider>
        );
    }
}
