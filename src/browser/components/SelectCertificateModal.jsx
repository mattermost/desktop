// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcRenderer} from 'electron';
import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {Modal, Button, Table, Row, Col} from 'react-bootstrap';

export default class SelectCertificateModal extends React.Component {
  static propTypes = {
    onSelect: PropTypes.func.isRequired,
    onCancel: PropTypes.func,
    certificateRequest: PropTypes.shape({
      server: PropTypes.string,
      certificateList: PropTypes.array,
    }),
  }

  constructor(props) {
    super(props);
    this.state = {
      selectedIndex: null,
    };
  }

  maxSize = (item, max) => {
    if (item.length <= max) {
      return item;
    }
    const sub = item.substring(0, max - 3);
    return `${sub}...`;
  }

  renderCert = (cert, index) => {
    const issuer = cert.issuer && cert.issuer.commonName ? this.maxSize(cert.issuer.commonName.split(':')[1], 10) : '';
    const subject = cert.subject && cert.subject.commonName ? this.maxSize(cert.subject.commonName.split(':')[1], 10) : '';
    const serial = cert.serialNumber ? this.maxSize(cert.serialNumber, 10) : '';
    const select = () => {
      this.setState({selectedIndex: index});
    };

    const style = this.state.selectedIndex === index ? {background: '#457AB2'} : {};
    return (
      <tr
        key={`cert-${index}`}
        onClick={select}
        style={style}
      >
        <td>{issuer}</td>
        <td>{subject}</td>
        <td>{serial}</td>
      </tr>);
  };

  renderCerts = (certificateList) => {
    if (certificateList) {
      const certs = certificateList.map(this.renderCert);
      return (
        <Fragment>
          {certs}
        </Fragment>
      );
    }
    return (<tr><td>{'No certificates to select'}</td></tr>);
  }

  getSelectedCert = () => {
    return this.state.selectedIndex === null ? null : this.props.certificateRequest.certificateList[this.state.selectedIndex];
  };

  handleOk = () => {
    const cert = this.getSelectedCert();
    if (cert !== null) {
      console.log(`selected cert: ${cert.serialNumber}`);
      this.props.onSelect(cert);
    }
  }

  handleCertificateInfo = () => {
    console.log('showing cert info');
    const certificate = this.getSelectedCert();
    if (certificate !== null) {
      ipcRenderer.send('show-trusted-cert', certificate);
    }
  }

  render() {
    const certList = this.props.certificateRequest ? this.props.certificateRequest.certificateList : [];
    return (
      <Modal
        bsClass='modal'
        className='SelectCertificateModal'
        show={this.props.certificateRequest !== null}
      >
        <Modal.Header>
          <Modal.Title>{'Select Certificate'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{`Select a certificate to authenticate yourself to ${this.props.certificateRequest}`}</p>
          <Table
            stripped={'true'}
            bordered={true}
            hover={true}
            size={'sm'}
          >
            <thead>
              <tr>
                <th>{'Subject'}</th>
                <th>{'Issuer'}</th>
                <th>{'Serial'}</th>
              </tr>
            </thead>
            <tbody>
              {this.renderCerts(certList)}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Row>
            <Col sm={4}>
              <Button
                variant={'info'}
                disabled={this.state.selectedIndex === null}
                onClick={this.handleCertificateInfo}
              >{'Certificate Information'}</Button>
            </Col>
            <Col sm={8}>
              <Button
                onClick={this.props.onCancel}
                variant={'secondary'}
              >{'Cancel'}</Button>
              <Button
                variant={'primary'}
                onClick={this.handleOk}
                disabled={this.state.selectedIndex === null}
              >{'Ok'}</Button>
            </Col>
          </Row>
        </Modal.Footer>
      </Modal>
    );
  }
}
