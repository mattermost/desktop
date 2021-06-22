// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import {Button, Col, ControlLabel, Form, FormGroup, FormControl, Modal} from 'react-bootstrap';

import {LoginModalData} from 'types/auth';
import {ModalMessage} from 'types/modals';
import {AuthenticationResponseDetails, AuthInfo} from 'electron/renderer';

import urlUtils from 'common/utils/url';
import {MODAL_INFO} from 'common/communication';

type Props = {
    onCancel: (request: AuthenticationResponseDetails) => void;
    onLogin: (request: AuthenticationResponseDetails, username: string, password: string) => void;
    getAuthInfo: () => void;
};

type State = {
    username: string;
    password: string;
    request?: AuthenticationResponseDetails;
    authInfo?: AuthInfo;
};

export default class LoginModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            username: '',
            password: '',
        };
    }

    componentDidMount() {
        window.addEventListener('message', this.handleAuthInfoMessage);

        this.props.getAuthInfo();
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.handleAuthInfoMessage);
    }

    handleAuthInfoMessage = (event: {data: ModalMessage<LoginModalData>}) => {
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

    handleSubmit = (event: React.MouseEvent<Button>) => {
        event.preventDefault();
        this.props.onLogin(this.state.request!, this.state.username, this.state.password);
        this.setState({
            username: '',
            password: '',
            request: undefined,
            authInfo: undefined,
        });
    }

    handleCancel = (event: React.MouseEvent<Button>) => {
        event.preventDefault();
        this.props.onCancel(this.state.request!);
        this.setState({
            username: '',
            password: '',
            request: undefined,
            authInfo: undefined,
        });
    }

    setUsername = (e: React.ChangeEvent<FormControl & HTMLInputElement>) => {
        this.setState({username: e.target.value});
    }

    setPassword = (e: React.ChangeEvent<FormControl & HTMLInputElement>) => {
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
            theServer = `The server ${tmpURL?.protocol}//${tmpURL?.host}`;
        }
        const message = `${theServer} requires a username and password.`;
        return (
            <Modal
                show={Boolean(this.state.request && this.state.authInfo)}
                onHide={() => {}}
            >
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
