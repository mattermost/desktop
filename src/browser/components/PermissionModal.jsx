// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable react/no-set-state */

import React from 'react';
import {Modal, Button} from 'react-bootstrap';
import {ipcRenderer, remote} from 'electron';
import {log} from 'electron-log';

import {BASIC_AUTH_PERMISSION, REQUEST_PERMISSION_CHANNEL, DENY_PERMISSION_CHANNEL, GRANT_PERMISSION_CHANNEL, PERMISSION_DESCRIPTION} from '../../common/permissions';

import Util from '../../utils/util';

import ExternalLink from './externalLink.jsx';

function getKey(request, permission) {
  return `${request.url}:${permission}`;
}

export default class PermissionModal extends React.Component {
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
      ipcRenderer.sendTo(remote.getCurrentWindow().webContents.id, 'login-request', request, authInfo);
      this.loadNext();
    }).catch((err) => {
      ipcRenderer.send(DENY_PERMISSION_CHANNEL, request.url, permission, err.message);
      ipcRenderer.send('login-cancel', request);
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
    return {
      grant: () => {
        const err = new Error();
        log.error(`There isn't any permission to grant access to.\n Stack trace:\n${err.stack}`);
      },
      deny: () => {
        const err = new Error();
        log.error(`There isn't any permission to deny access to.\n Stack trace:\n${err.stack}`);
      }
    };
  }

  loadNext() {
    const tracker = new Map(this.state.tracker);
    tracker.delete(this.state.current);
    const nextKey = tracker.keys().next();
    const current = nextKey.done ? null : nextKey.value;
    this.setState({
      tracker,
      current,
    });
  }

  getModalTitle() {
    const {permission} = this.getCurrentData();
    return `${PERMISSION_DESCRIPTION[permission]} Required`;
  }

  getModalBody() {
    const {url, permission} = this.getCurrentData();
    const originDisplay = url ? Util.getHost(url) : 'unknown origin';
    const originLink = url ? originDisplay : '';
    return (
      <div>
        <p>
          {`A site that's not included in your Mattermost server configuration requires access for ${PERMISSION_DESCRIPTION[permission]}.`}
        </p>
        <p>
          <span>{'This request originated from '}</span>
          <ExternalLink href={originLink}>{`${originDisplay}`}</ExternalLink>
        </p>
      </div>
    );
  }

  render() {
    const {grant, deny} = this.getCurrentData();
    return (
      <Modal
        bsClass='modal'
        className='permission-modal'
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
        <Modal.Footer className={'remove-border'}>
          <div>
            <Button
              onClick={deny}
            >{'Cancel'}</Button>
            <Button
              bsStyle='primary'
              onClick={grant}
            >{'Accept'}</Button>
          </div>
        </Modal.Footer>
      </Modal>
    );
  }
}
/* eslint-enable react/no-set-state */
