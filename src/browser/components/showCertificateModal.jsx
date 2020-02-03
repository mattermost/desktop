// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {Modal, Button, Row, Col} from 'react-bootstrap';

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
    const certificateSection = (descriptor) => {
      return (
        <Fragment>
          <dt className={'certificate-key'}>{descriptor}</dt>
          <dd className={'certificate-section'}><span/></dd>
        </Fragment>
      );
    };
    const certificateItem = (descriptor, value) => {
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
        >
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
        className='show-certificate'
        show={this.state.certificate !== null}
        scrollable={'true'}
      >
        <Modal.Header className={'no-border'}>
          <Modal.Title>{'Certificate information'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className='details'>{'Details'}</p>
          <dl>
            {certificateSection('Subject Name')}
            {certificateItem('Common Name', this.state.certificate.subject.commonName)}
          </dl>
          <dl>
            {certificateSection('Issuer Name')}
            {certificateItem('Common Name', this.state.certificate.issuer.commonName)}
          </dl>
          <dl>
            {certificateItem('Serial Number', this.state.certificate.serialNumber)}
            {certificateItem('Not Valid Before', creation.toLocaleString(dateLocale, dateDisplayOptions))}
            {certificateItem('Not Valid After', expiration.toLocaleString(dateLocale, dateDisplayOptions))}
          </dl>
          <dl>
            {certificateSection('Public Key Info')}
            {certificateItem('Algorithm', this.state.certificate.fingerprint.split('/')[0])}
          </dl>
        </Modal.Body>
        <Modal.Footer className={'no-border'}>
          <div className='container-fluid'>
            <Row>
              <Col>
                <Button
                  variant={'primary'}
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