// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {Modal, Button, Table, Row, Col} from 'react-bootstrap';

import ShowCertificateModal from './showCertificateModal.jsx';

const CELL_SIZE = 23;
const ELIPSIS_SIZE = 3;

export default class SelectCertificateModal extends React.Component {
  static propTypes = {
    onSelect: PropTypes.func.isRequired,
    onCancel: PropTypes.func,
    certificateRequests: PropTypes.arrayOf(PropTypes.shape({
      server: PropTypes.string,
      certificateList: PropTypes.array,
    })),
  }

  constructor(props) {
    super(props);
    this.state = {
      selectedIndex: null,
      showCertificate: null,
    };
  }

  maxSize = (item, max) => {
    if (!item || item.length <= max) {
      return item;
    }
    const sub = item.substring(0, max - ELIPSIS_SIZE);
    return `${sub}...`;
  }

  selectfn = (index) => {
    return (() => {
      this.setState({selectedIndex: index});
    });
  };

  renderCert = (cert, index) => {
    const issuer = cert.issuer && cert.issuer.commonName ? cert.issuer.commonName : '';
    const subject = cert.subject && cert.subject.commonName ? cert.subject.commonName : '';
    const serial = cert.serialNumber || '';

    const issuerShort = this.maxSize(cert.issuer.commonName, CELL_SIZE);
    const subjectShort = this.maxSize(cert.subject.commonName, CELL_SIZE);
    const serialShort = this.maxSize(cert.serialNumber, CELL_SIZE);

    const style = this.state.selectedIndex === index ? {background: '#457AB2', color: '#FFFFFF'} : {};
    return (
      <tr
        key={`cert-${index}`}
        onClick={this.selectfn(index)}
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
    return this.state.selectedIndex === null ? null : this.props.certificateRequests[0].certificateList[this.state.selectedIndex];
  };

  handleOk = () => {
    const cert = this.getSelectedCert();
    if (cert !== null) {
      this.props.onSelect(cert);
    }
  }

  handleCertificateInfo = () => {
    const certificate = this.getSelectedCert();
    this.setState({showCertificate: certificate});
  }

  certificateInfoClose = () => {
    this.setState({showCertificate: null});
  }

  render() {
    const certList = this.props.certificateRequests.length ? this.props.certificateRequests[0].certificateList : [];
    const server = this.props.certificateRequests.length ? this.props.certificateRequests[0].server : '';
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
        className='certificateModal'
        show={this.props.certificateRequests.length}
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
