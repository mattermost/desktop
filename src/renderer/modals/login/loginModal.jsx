// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import PropTypes from 'prop-types';
import {Button, Col, ControlLabel, Form, FormGroup, FormControl, Modal} from 'react-bootstrap';

import {MODAL_INFO} from 'common/communication';
import urlUtils from 'common/utils/url';

export default class LoginModal extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            username: '',
            password: '',
            request: null,
            authInfo: null,
        };
    }

    componentDidMount() {
        window.addEventListener('message', this.handleAuthInfoMessage);

        this.props.getAuthInfo();
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.handleAuthInfoMessage);
    }

    handleAuthInfoMessage = (event) => {
        switch (event.data.type) {
        case MODAL_INFO: {
            const {request, authInfo} = event.data.data;
            this.setState({request, authInfo});
            break;
        }
        default:
            break;
        }
    }

    handleSubmit = (event) => {
        event.preventDefault();
        this.props.onLogin(this.state.request, this.state.username, this.state.password);
        this.setState({
            username: '',
            password: '',
            request: null,
            authInfo: null,
        });
    }

    handleCancel = (event) => {
        event.preventDefault();
        this.props.onCancel(this.state.request);
        this.setState({
            username: '',
            password: '',
            request: null,
            authInfo: null,
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
        if (!(this.state.request && this.state.authInfo)) {
            theServer = '';
        } else if (this.state.authInfo.isProxy) {
            theServer = `The proxy ${this.state.authInfo.host}:${this.state.authInfo.port}`;
        } else {
            const tmpURL = urlUtils.parseURL(this.state.request.url);
            theServer = `The server ${tmpURL.protocol}//${tmpURL.host}`;
        }
        const message = `${theServer} requires a username and password.`;
        return (
            <Modal show={Boolean(this.state.request && this.state.authInfo)}>
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
    onCancel: PropTypes.func,
    onLogin: PropTypes.func,
    getAuthInfo: PropTypes.func,
};
