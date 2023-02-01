// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import {Button, Col, FormLabel, Form, FormGroup, FormControl, Modal} from 'react-bootstrap';
import {FormattedMessage, injectIntl, IntlShape} from 'react-intl';

import {LoginModalData} from 'types/auth';
import {ModalMessage} from 'types/modals';
import {AuthenticationResponseDetails, AuthInfo} from 'electron/renderer';

import urlUtils from 'common/utils/url';
import {MODAL_INFO} from 'common/communication';

type Props = {
    onCancel: (request: AuthenticationResponseDetails) => void;
    onLogin: (request: AuthenticationResponseDetails, username: string, password: string) => void;
    getAuthInfo: () => void;
    intl: IntlShape;
};

type State = {
    username: string;
    password: string;
    request?: AuthenticationResponseDetails;
    authInfo?: AuthInfo;
};

class LoginModal extends React.PureComponent<Props, State> {
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

    handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        this.props.onLogin(this.state.request!, this.state.username, this.state.password);
        this.setState({
            username: '',
            password: '',
            request: undefined,
            authInfo: undefined,
        });
    }

    handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        this.props.onCancel(this.state.request!);
        this.setState({
            username: '',
            password: '',
            request: undefined,
            authInfo: undefined,
        });
    }

    setUsername = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({username: e.target.value});
    }

    setPassword = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({password: e.target.value});
    }

    renderLoginModalMessage = () => {
        if (!(this.state.request && this.state.authInfo)) {
            return null;
        } else if (this.state.authInfo.isProxy) {
            return (
                <FormattedMessage
                    id='renderer.modals.login.loginModal.message.proxy'
                    defaultMessage='The proxy {host}:{port} requires a username and password.'
                    values={{host: this.state.authInfo.host, port: this.state.authInfo.port}}
                />
            );
        }
        const tmpURL = urlUtils.parseURL(this.state.request.url);
        return (
            <FormattedMessage
                id='renderer.modals.login.loginModal.message.server'
                defaultMessage='The server {url} requires a username and password.'
                values={{url: `${tmpURL?.protocol}//${tmpURL?.host}`}}
            />
        );
    }

    render() {
        const {intl} = this.props;

        return (
            <Modal
                show={Boolean(this.state.request && this.state.authInfo)}
            >
                <Modal.Header>
                    <Modal.Title>
                        <FormattedMessage
                            id='renderer.modals.login.loginModal.title'
                            defaultMessage='Authentication Required'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        {this.renderLoginModalMessage()}
                    </p>
                    <Form
                        onSubmit={this.handleSubmit}
                    >
                        <FormGroup>
                            <Col
                                as={FormLabel}
                                sm={2}
                            >
                                <FormattedMessage
                                    id='renderer.modals.login.loginModal.username'
                                    defaultMessage='User Name'
                                />
                            </Col>
                            <Col sm={10}>
                                <FormControl
                                    type='text'
                                    placeholder={intl.formatMessage({id: 'renderer.modals.login.loginModal.username', defaultMessage: 'User Name'})}
                                    onChange={this.setUsername}
                                    value={this.state.username}
                                    onClick={(e: React.MouseEvent<HTMLInputElement>) => {
                                        e.stopPropagation();
                                    }}
                                />
                            </Col>
                        </FormGroup>
                        <FormGroup>
                            <Col
                                as={FormLabel}
                                sm={2}
                            >
                                <FormattedMessage
                                    id='renderer.modals.login.loginModal.password'
                                    defaultMessage='Password'
                                />
                            </Col>
                            <Col sm={10}>
                                <FormControl
                                    type='password'
                                    placeholder={intl.formatMessage({id: 'renderer.modals.login.loginModal.password', defaultMessage: 'Password'})}
                                    onChange={this.setPassword}
                                    value={this.state.password}
                                    onClick={(e: React.MouseEvent<HTMLInputElement>) => {
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
                                        variant='primary'
                                    >
                                        <FormattedMessage
                                            id='label.login'
                                            defaultMessage='Login'
                                        />
                                    </Button>
                                    { ' ' }
                                    <Button
                                        variant='link'
                                        onClick={this.handleCancel}
                                    >
                                        <FormattedMessage
                                            id='label.cancel'
                                            defaultMessage='Cancel'
                                        />
                                    </Button>
                                </div>
                            </Col>
                        </FormGroup>
                    </Form>
                </Modal.Body>
            </Modal>
        );
    }
}

export default injectIntl(LoginModal);
