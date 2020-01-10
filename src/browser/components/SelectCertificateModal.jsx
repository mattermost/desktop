// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcRenderer} from 'electron';
import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {Modal, Button, Table, Row, Col} from 'react-bootstrap';

const CELL_SIZE = 23;
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
    const issuer = cert.issuer && cert.issuer.commonName ? cert.issuer.commonName : '';
    const subject = cert.subject && cert.subject.commonName ? cert.subject.commonName: '';
    const serial = cert.serialNumber || '';

    const issuerShort = this.maxSize(cert.issuer.commonName.split(':')[1], CELL_SIZE);
    const subjectShort = this.maxSize(cert.subject.commonName.split(':')[1], CELL_SIZE);
    const serialShort =  this.maxSize(cert.serialNumber, CELL_SIZE);
    const select = () => {
      this.setState({selectedIndex: index});
    };

    const style = this.state.selectedIndex === index ? {background: '#457AB2', color: '#FFFFFF'} : {};
    return (
      <tr
        key={`cert-${index}`}
        onClick={select}
        style={style}
      >
        <td
          style={style}
          title={issuer}
        >{issuerShort}</td>
        <td
          style={style}
          title={subject}
        >{subjectShort}</td>
        <td
          style={style}
          title={serial}
        >{serialShort}</td>
      </tr>);
  };

  renderCerts = (certificateList) => {
    if (!certificateList) {
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
    return this.state.selectedIndex === null ? null : this.props.certificateRequest.certificateList[this.state.selectedIndex];
  };

  handleOk = () => {
    const cert = this.getSelectedCert();
    if (cert !== null) {
      this.props.onSelect(cert);
    }
  }

  handleCertificateInfo = () => {
    const certificate = this.getSelectedCert();
    if (certificate !== null) {
      ipcRenderer.send('show-trusted-cert', certificate);
    }
  }

  render() {
    const certList = this.props.certificateRequest ? this.props.certificateRequest.certificateList : [];
    const server = this.props.certificateRequest ? this.props.certificateRequest.server : '';
    return (
      <Modal
        bsClass='modal'
        className='certificateModal'
        show={this.props.certificateRequest !== null}
      >
        <Modal.Header className={'noBorder'}>
          <Modal.Title className={'bottomBorder'}>{'Select a certificate'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className={'subtitle'}>{`Select a certificate to authenticate yourself to ${server}`}</p>
          <Table
            stripped={'true'}
            hover={true}
            size={'sm'}
            className='certificateList'
          >
            <thead>
              <tr>
                <th><span className={'divider'}>{'Subject'}</span></th>
                <th><span className={'divider'}>{'Issuer'}</span></th>
                <th>{'Serial'}</th>
              </tr>
            </thead>
            <tbody>
              {this.renderCerts(certList)}
              <tr/* this is to correct table height without affecting real rows *//>
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer className={'noBorder'}>
          <Row className={'topBorder'}>
            <Col sm={4}>
              <Button
                variant={'info'}
                disabled={this.state.selectedIndex === null}
                onClick={this.handleCertificateInfo}
                className={'info'}
              >{'Certificate Information'}</Button>
            </Col>
            <Col sm={8}>
              <Button
                onClick={this.props.onCancel}
                variant={'secondary'}
                className={'secondary'}
              >{'Cancel'}</Button>
              <Button
                variant={'primary'}
                onClick={this.handleOk}
                disabled={this.state.selectedIndex === null}
                className={'primary'}
              >{'Ok'}</Button>
            </Col>
          </Row>
        </Modal.Footer>
      </Modal>
    );
  }
}
