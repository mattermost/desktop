// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {Modal, Button, Row} from 'react-bootstrap';

export default class ShowCertificateModal extends React.Component {
  static propTypes = {
    certificate: PropTypes.object,
    onOk: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      certificate: props.certificate,
    };
  }

  handleOk = () => {
    this.setState({certificate: null});
    this.props.onOk();
  }

  render() {
    const certificateItem = (descriptor, value) => {
      const ddclass = value ? '' : 'emtpyDescriptor';
      const val = value ? `${value}` : <span/>;
      return (
        <Fragment>
          <dt>{descriptor}</dt>
          <dd className={ddclass}>{val}</dd>
        </Fragment>
      );
    };

    if (this.state.certificate === null) {
      return (
        <Modal>
          <Modal.Body>
            {'No certificate Selected'}
          </Modal.Body>
        </Modal>
      );
    }

    const utcSeconds = (date) => {
      const d = new Date(0);
      d.setUTCSeconds(date);
      return d;
    };

    const expiration = utcSeconds(this.state.certificate.validExpiry);
    const creation = utcSeconds(this.state.certificate.validStart);
    const dateDisplayOptions = {dateStyle: 'full', timeStyle: 'full'};
    const dateLocale = 'en-US';
    return (
      <Modal
        bsClass='modal'
        className='certificateModal'
        show={this.state.certificate !== null}
        scrollable={true}
      >
        <Modal.Header className={'noBorder'}>
          <Modal.Title className={'bottomBorder'}>{'Certificate Information'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <h3 className={'certificateKey'}>{`${this.state.certificate.subject.commonName}`}</h3>
          <p className={'certInfo'}>{`Issued by: ${this.state.certificate.issuer.commonName}`}</p>
          <p className={'certInfo'}>{`Expires: ${expiration.toLocaleString(dateLocale, dateDisplayOptions)}`}</p>
          <p>{'Details'}</p>
          <dl>
            {certificateItem('Subject Name')}
            {certificateItem('Common Name', this.state.certificate.subject.commonName)}
            {certificateItem('Issuer Name')}
            {certificateItem('Common Name', this.state.certificate.issuer.commonName)}
            {certificateItem('Serial Number', this.state.certificate.serialNumber)}
            {certificateItem('Not Valid Before', creation.toLocaleString(dateLocale, dateDisplayOptions))}
            {certificateItem('Not Valid After', expiration.toLocaleString(dateLocale, dateDisplayOptions))}
            {certificateItem('Public Key Info')}
            {certificateItem('Algorithm', this.state.certificate.fingerprint.split('/')[0])}
          </dl>
        </Modal.Body>
        <Modal.Footer className={'noBorder'}>
          <Row className={'topBorder'}>
            <Button
              variant={'primary'}
              onClick={this.handleOk}
              className={'primary'}
            >{'Close'}</Button>
          </Row>
        </Modal.Footer>
      </Modal>
    );
  }
}