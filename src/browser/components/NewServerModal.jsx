// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {Modal, Button, FormGroup, FormControl, ControlLabel, HelpBlock} from 'react-bootstrap';

export default class NewServerModal extends React.Component {
  constructor() {
    super();

    this.wasShown = false;
    this.state = {
      serverName: '',
      serverUrl: '',
      saveStarted: false,
    };
  }

  initializeOnShow() {
    this.setState({
      serverName: this.props.server ? this.props.server.name : '',
      serverUrl: this.props.server ? this.props.server.url : '',
      serverIndex: this.props.server ? this.props.server.index : false,
      saveStarted: false,
    });
  }

  getServerNameValidationError() {
    if (!this.state.saveStarted) {
      return null;
    }
    return this.state.serverName.length > 0 ? null : 'Name is required.';
  }

  getServerNameValidationState() {
    return this.getServerNameValidationError() === null ? null : 'error';
  }

  handleServerNameChange(e) {
    this.setState({
      serverName: e.target.value,
    });
  }

  getServerUrlValidationError() {
    if (!this.state.saveStarted) {
      return null;
    }
    if (this.state.serverUrl.length === 0) {
      return 'URL is required.';
    }
    if (!(/^https?:\/\/.*/).test(this.state.serverUrl.trim())) {
      return 'URL should start with http:// or https://.';
    }
    return null;
  }

  getServerUrlValidationState() {
    return this.getServerUrlValidationError() === null ? null : 'error';
  }

  handleServerUrlChange(e) {
    this.setState({
      serverUrl: e.target.value,
    });
  }

  getError() {
    const nameError = this.getServerNameValidationError();
    const urlError = this.getServerUrlValidationError();

    if (nameError && urlError) {
      return 'Name and URL are required.';
    } else if (nameError) {
      return nameError;
    } else if (urlError) {
      return urlError;
    }
    return null;
  }

  validateForm() {
    return this.getServerNameValidationState() === null &&
           this.getServerUrlValidationState() === null;
  }

  save() {
    this.setState({
      saveStarted: true,
    }, () => {
      if (this.validateForm()) {
        this.props.onSave({
          url: this.state.serverUrl,
          name: this.state.serverName,
          index: this.state.serverIndex,
        });
      }
    });
  }

  getSaveButtonLabel() {
    if (this.props.editMode) {
      return 'Save';
    }
    return 'Add';
  }

  getModalTitle() {
    if (this.props.editMode) {
      return 'Edit Server';
    }
    return 'Add Server';
  }

  render() {
    if (this.wasShown !== this.props.show && this.props.show) {
      this.initializeOnShow();
    }
    this.wasShown = this.props.show;

    return (
      <Modal
        bsClass='modal'
        className='NewServerModal'
        show={this.props.show}
        id='newServerModal'
        onHide={this.props.onClose}
        onKeyDown={(e) => {
          switch (e.key) {
          case 'Enter':
            this.save();

            // The add button from behind this might still be focused
            e.preventDefault();
            e.stopPropagation();
            break;
          case 'Escape':
            this.props.onClose();
            break;
          }
        }}
      >
        <Modal.Header>
          <Modal.Title>{this.getModalTitle()}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <form>
            <FormGroup
              validationState={this.getServerNameValidationState()}
            >
              <ControlLabel>{'Server Display Name'}</ControlLabel>
              <FormControl
                id='serverNameInput'
                type='text'
                value={this.state.serverName}
                placeholder='Server Name'
                onChange={this.handleServerNameChange.bind(this)}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              />
              <FormControl.Feedback/>
              <HelpBlock>{'The name of the server displayed on your desktop app tab bar.'}</HelpBlock>
            </FormGroup>
            <FormGroup
              className='NewServerModal-noBottomSpace'
              validationState={this.getServerUrlValidationState()}
            >
              <ControlLabel>{'Server URL'}</ControlLabel>
              <FormControl
                id='serverUrlInput'
                type='text'
                value={this.state.serverUrl}
                placeholder='https://example.com'
                onChange={this.handleServerUrlChange.bind(this)}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              />
              <FormControl.Feedback/>
              <HelpBlock className='NewServerModal-noBottomSpace'>{'The URL of your Mattermost server. Must start with http:// or https://.'}</HelpBlock>
            </FormGroup>
          </form>
        </Modal.Body>

        <Modal.Footer>
          <div
            className='pull-left modal-error'
          >
            {this.getError()}
          </div>

          <Button
            id='cancelNewServerModal'
            onClick={this.props.onClose}
          >{'Cancel'}</Button>
          <Button
            id='saveNewServerModal'
            onClick={this.save.bind(this)}
            disabled={!this.validateForm()}
            bsStyle='primary'
          >{this.getSaveButtonLabel()}</Button>
        </Modal.Footer>

      </Modal>
    );
  }
}

NewServerModal.propTypes = {
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  server: PropTypes.object,
  editMode: PropTypes.bool,
  show: PropTypes.bool,
};
