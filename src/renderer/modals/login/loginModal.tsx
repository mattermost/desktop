// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import type {AuthenticationResponseDetails, AuthInfo} from 'electron/renderer';
import React from 'react';
import type {IntlShape} from 'react-intl';
import {FormattedMessage, injectIntl} from 'react-intl';

import {parseURL} from 'common/utils/url';
import Input, {SIZE} from 'renderer/components/Input';
import {Modal} from 'renderer/components/Modal';

import type {LoginModalInfo} from 'types/modals';

type Props = {
    onCancel: (request: AuthenticationResponseDetails) => void;
    onLogin: (request: AuthenticationResponseDetails, username: string, password: string) => void;
    getAuthInfo: () => Promise<LoginModalInfo>;
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

    async componentDidMount() {
        await this.getAuthInfo();
    }

    getAuthInfo = async () => {
        const {request, authInfo} = await this.props.getAuthInfo();
        this.setState({request, authInfo});
    };

    handleSubmit = () => {
        this.props.onLogin(this.state.request!, this.state.username, this.state.password);
        this.setState({
            username: '',
            password: '',
            request: undefined,
            authInfo: undefined,
        });
    };

    handleCancel = () => {
        this.props.onCancel(this.state.request!);
        this.setState({
            username: '',
            password: '',
            request: undefined,
            authInfo: undefined,
        });
    };

    setUsername = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({username: e.target.value});
    };

    setPassword = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({password: e.target.value});
    };

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
        const tmpURL = parseURL(this.state.request.url);
        return (
            <FormattedMessage
                id='renderer.modals.login.loginModal.message.server'
                defaultMessage='The server {url} requires a username and password.'
                values={{url: `${tmpURL?.protocol}//${tmpURL?.host}`}}
            />
        );
    };

    render() {
        const {intl} = this.props;

        return (
            <Modal
                id='loginModal'
                show={Boolean(this.state.request && this.state.authInfo)}
                onExited={this.handleCancel}
                modalHeaderText={
                    <FormattedMessage
                        id='renderer.modals.login.loginModal.title'
                        defaultMessage='Authentication Required'
                    />
                }
                handleConfirm={this.handleSubmit}
                handleEnterKeyPress={this.handleSubmit}
                confirmButtonText={
                    <FormattedMessage
                        id='label.login'
                        defaultMessage='Login'
                    />
                }
                handleCancel={this.handleCancel}
                modalSubheaderText={this.renderLoginModalMessage()}
            >
                <Input
                    autoFocus={true}
                    id='loginModalUsername'
                    name='username'
                    type='text'
                    inputSize={SIZE.LARGE}
                    value={this.state.username}
                    onChange={this.setUsername}
                    placeholder={intl.formatMessage({id: 'renderer.modals.login.loginModal.username', defaultMessage: 'User Name'})}
                />
                <Input
                    id='loginModalPassword'
                    name='password'
                    type='password'
                    inputSize={SIZE.LARGE}
                    onChange={this.setPassword}
                    value={this.state.password}
                    placeholder={intl.formatMessage({id: 'renderer.modals.login.loginModal.password', defaultMessage: 'Password'})}
                />
            </Modal>
        );
    }
}

export default injectIntl(LoginModal);
