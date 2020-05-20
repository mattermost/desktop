// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import PropTypes from 'prop-types';
import {Button, Col, ControlLabel, Form, FormGroup, FormControl, Modal} from 'react-bootstrap';

export default class LoginModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      username: '',
      password: '',
    };
  }

  handleSubmit = (event) => {
    event.preventDefault();
    this.props.onLogin(this.props.request, this.state.username, this.state.password);
    this.setState({
      username: '',
      password: '',
    });
  }

  handleCancel = (event) => {
    event.preventDefault();
    this.props.onCancel(this.props.request);
    this.setState({
      username: '',
      password: '',
    });
  }

  setUsername = (e) => {
    this.setState({username: e.target.value});
  }

  setPassword = (e) => {
    this.setState({password: e.target.value});
  }

  render() {
    let theServer = '';
    if (!this.props.show) {
      theServer = '';
    } else if (this.props.authInfo.isProxy) {
      theServer = `The proxy ${this.props.authInfo.host}:${this.props.authInfo.port}`;
    } else {
      theServer = `The server ${this.props.authServerURL}`;
    }
    const message = `${theServer} requires a username and password.`;
    return (
      <Modal show={this.props.show}>
        <Modal.Header>
          <Modal.Title>{'Authentication Required'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            { message }
          </p>
          <Form
            horizontal={true}
            onSubmit={this.handleSubmit}
          >
            <FormGroup>
              <Col
                componentClass={ControlLabel}
                sm={2}
              >{'User Name'}</Col>
              <Col sm={10}>
                <FormControl
                  type='text'
                  placeholder='User Name'
                  onChange={this.setUsername}
                  value={this.state.username}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              </Col>
            </FormGroup>
            <FormGroup>
              <Col
                componentClass={ControlLabel}
                sm={2}
              >{'Password'}</Col>
              <Col sm={10}>
                <FormControl
                  type='password'
                  placeholder='Password'
                  onChange={this.setPassword}
                  value={this.state.password}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              </Col>
            </FormGroup>
            <FormGroup>
              <Col sm={12}>
                <div className='pull-right'>
                  <Button
                    type='submit'
                    bsStyle='primary'
                  >{'Login'}</Button>
                  { ' ' }
                  <Button onClick={this.handleCancel}>{'Cancel'}</Button>
                </div>
              </Col>
            </FormGroup>
          </Form>
        </Modal.Body>
      </Modal>
    );
  }
}

LoginModal.propTypes = {
  authInfo: PropTypes.object,
  authServerURL: PropTypes.string,
  onCancel: PropTypes.func,
  onLogin: PropTypes.func,
  request: PropTypes.object,
  show: PropTypes.bool,
};
