// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable react/no-set-state */

import React from 'react';
import PropTypes from 'prop-types';
import {Modal, Button} from 'react-bootstrap';
import {ipcRenderer} from 'electron';

import {BASIC_AUTH_PERMISSION, REQUEST_PERMISSION_CHANNEL, DENY_PERMISSION_CHANNEL, GRANT_PERMISSION_CHANNEL, PERMISSION_DESCRIPTION} from '../../common/permissions';
import Util from '../../utils/util';

function getKey(request, permission) {
  return `${request.url}:${permission}`;
}

export default class PermissionModal extends React.Component {
  static propTypes = {
    webContentsId: PropTypes.number.isRequired,
  }

  constructor(props) {
    super(props);
    this.state = {
      tracker: new Map(), // permission request order is not preserved, but we won't have repetition of requests.
      current: null,
    };

    ipcRenderer.on(REQUEST_PERMISSION_CHANNEL, (event, request, authInfo, permission) => {
      switch (permission) {
      case BASIC_AUTH_PERMISSION:
        this.requestBasicAuthPermission(event, request, authInfo, permission);
        break;
      default:
        console.warn(`Unknown permission request: ${permission}`);
        ipcRenderer.send(DENY_PERMISSION_CHANNEL, request, permission);
      }
    });
  }

  requestBasicAuthPermission(event, request, authInfo, permission) {
    const key = getKey(request, permission);
    this.requestPermission(key, request.url, permission).then(() => {
      ipcRenderer.send(GRANT_PERMISSION_CHANNEL, request.url, permission);
      ipcRenderer.sendTo(this.props.webContentsId, 'login-request', request, authInfo);
      this.loadNext();
    }).catch((err) => {
      ipcRenderer.send(DENY_PERMISSION_CHANNEL, request.url, permission, err.message);
      this.loadNext();
    });
  }

  requestPermission(key, url, permission) {
    return new Promise((resolve, reject) => {
      const tracker = new Map(this.state.tracker);
      const permissionRequest = {
        grant: resolve,
        deny: () => reject(new Error(`User denied ${permission} to ${url}`)),
        url,
        permission,
      };
      tracker.set(key, permissionRequest);
      const current = this.state.current ? this.state.current : key;
      this.setState({
        tracker,
        current,
      });
    });
  }

  getCurrentData() {
    if (this.state.current) {
      return this.state.tracker.get(this.state.current);
    }
    return {};
  }

  loadNext() {
    const tracker = new Map(this.state.tracker);
    tracker.delete(this.state.current);
    let current = null;
    if (tracker.size > 0) {
      current = tracker.keys().next();
    }
    this.setState({
      tracker,
      current,
    });
  }

  getModalTitle() {
    const {permission} = this.getCurrentData();
    return `Permission request for: ${PERMISSION_DESCRIPTION[permission]}`;
  }

  getModalBody() {
    const {url, permission} = this.getCurrentData();
    const origin = url ? Util.getHost(url) : 'unknown origin';
    return (
      <div>
        <p>
          {`A site external to your configured Mattermost server has requested to be able to perform the following action: ${PERMISSION_DESCRIPTION[permission]}`}
        </p>
        <p>
          {`Request originated from: ${origin}`}
        </p>
      </div>
    );
  }

  render() {
    const {grant, deny} = this.getCurrentData();
    return (
      <Modal
        bsClass='modal'
        show={Boolean(this.state.current)}
        id='requestPermissionModal'
        enforceFocus={true}
      >
        <Modal.Header>
          <Modal.Title>{this.getModalTitle()}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {this.getModalBody()}
        </Modal.Body>
        <Modal.Footer>
          <div>
            <Button
              bsStyle='warning'
              onClick={grant}
            >{'Grant'}</Button>
            <Button
              bsStyle='link'
              onClick={deny}
            >{'Deny'}</Button>
          </div>
        </Modal.Footer>
      </Modal>
    );
  }
}
/* eslint-enable react/no-set-state */
