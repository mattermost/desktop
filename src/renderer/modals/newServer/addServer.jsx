// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {Button, FormGroup, FormControl, ControlLabel, HelpBlock} from 'react-bootstrap';

//import Utils from 'common/utils/util';

export default class NewTeamModal extends React.Component {
  static defaultProps = {
    restoreFocus: true,
  };

  constructor(props) {
    super(props);

    this.wasShown = false;
    this.state = {
      teamName: '',
      teamUrl: '',
      teamOrder: props.currentOrder || 0,
      saveStarted: false,
    };
  }

  initializeOnShow() {
    this.setState({
      teamName: this.props.team ? this.props.team.name : '',
      teamUrl: this.props.team ? this.props.team.url : '',
      teamIndex: this.props.team ? this.props.team.index : false,
      teamOrder: this.props.team ? this.props.team.order : (this.props.currentOrder || 0),
      saveStarted: false,
    });
  }

  getTeamNameValidationError() {
    if (!this.state.saveStarted) {
      return null;
    }
    return this.state.teamName.length > 0 ? null : 'Name is required.';
  }

  getTeamNameValidationState() {
    return this.getTeamNameValidationError() === null ? null : 'error';
  }

  handleTeamNameChange = (e) => {
    this.setState({
      teamName: e.target.value,
    });
  }

  getTeamUrlValidationError() {
    if (!this.state.saveStarted) {
      return null;
    }
    if (this.state.teamUrl.length === 0) {
      return 'URL is required.';
    }
    if (!(/^https?:\/\/.*/).test(this.state.teamUrl.trim())) {
      return 'URL should start with http:// or https://.';
    }

    // todo: reload once we are on par with v4.6 which removes url usage
    // if (!Utils.isValidURL(this.state.teamUrl.trim())) {
    //   return 'URL is not formatted correctly.';
    // }
    return null;
  }

  getTeamUrlValidationState() {
    return this.getTeamUrlValidationError() === null ? null : 'error';
  }

  handleTeamUrlChange = (e) => {
    this.setState({
      teamUrl: e.target.value,
    });
  }

  getError() {
    const nameError = this.getTeamNameValidationError();
    const urlError = this.getTeamUrlValidationError();

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
    return this.getTeamNameValidationState() === null &&
           this.getTeamUrlValidationState() === null;
  }

  save = () => {
    this.setState({
      saveStarted: true,
    }, () => {
      if (this.validateForm()) {
        this.props.onSave({
          url: this.state.teamUrl,
          name: this.state.teamName,
          index: this.state.teamIndex,
          order: this.state.teamOrder,
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
      <div className='modal'>
        <div className='modalHeader'>
          {'Add Server'}
        </div>
        <form>
          <FormGroup
            validationState={this.getTeamNameValidationState()}
          >
            <ControlLabel>{'Server Display Name'}</ControlLabel>
            <FormControl
              id='teamNameInput'
              type='text'
              value={this.state.teamName}
              placeholder='Server Name'
              onChange={this.handleTeamNameChange}
              inputRef={(ref) => {
                this.teamNameInputRef = ref;
                if (this.props.setInputRef) {
                  this.props.setInputRef(ref);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              autoFocus={true}
            />
            <FormControl.Feedback/>
            <HelpBlock>{'The name of the server displayed on your desktop app tab bar.'}</HelpBlock>
          </FormGroup>
          <FormGroup
            className='NewTeamModal-noBottomSpace'
            validationState={this.getTeamUrlValidationState()}
          >
            <ControlLabel>{'Server URL'}</ControlLabel>
            <FormControl
              id='teamUrlInput'
              type='text'
              value={this.state.teamUrl}
              placeholder='https://example.com'
              onChange={this.handleTeamUrlChange}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
            <FormControl.Feedback/>
            <HelpBlock className='NewTeamModal-noBottomSpace'>{'The URL of your Mattermost server. Must start with http:// or https://.'}</HelpBlock>
          </FormGroup>
        </form>
        <div className='modalFooter'>
          <div className='pull-left modal-error'>{this.getError()}</div>
          <Button
            className='default'
            id='cancelNewServerModal'
            onClick={this.props.onClose}
          >{'Cancel'}</Button>
          <Button
            className='primary'
            id='saveNewServerModal'
            onClick={this.save}
            disabled={!this.validateForm()}
            bsStyle='primary'
          >{this.getSaveButtonLabel()}
          </Button>
        </div>
      </div>
    );
  }
}

NewTeamModal.propTypes = {
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  team: PropTypes.object,
  editMode: PropTypes.bool,
  show: PropTypes.bool,
  restoreFocus: PropTypes.bool,
  currentOrder: PropTypes.number,
  setInputRef: PropTypes.func,
};
