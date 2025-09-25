// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import type {AuthenticationResponseDetails, AuthInfo} from 'electron/renderer';
import React, {useState, useEffect, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import Input, {SIZE} from 'renderer/components/Input';
import {Modal} from 'renderer/components/Modal';

import type {LoginModalInfo} from 'types/modals';

type Props = {
    onCancel: (request: AuthenticationResponseDetails) => void;
    onLogin: (request: AuthenticationResponseDetails, username: string, password: string) => void;
    getAuthInfo: () => Promise<LoginModalInfo>;
};

export default function LoginModal({onCancel, onLogin, getAuthInfo}: Props) {
    const intl = useIntl();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [request, setRequest] = useState<AuthenticationResponseDetails | undefined>();
    const [authInfo, setAuthInfo] = useState<AuthInfo | undefined>();

    const getAuthInfoData = useCallback(async () => {
        const {request: authRequest, authInfo: authInfoData} = await getAuthInfo();
        setRequest(authRequest);
        setAuthInfo(authInfoData);
    }, [getAuthInfo]);

    useEffect(() => {
        getAuthInfoData();
    }, []);

    const handleSubmit = useCallback(() => {
        if (request) {
            onLogin(request, username, password);
        }
    }, [onLogin, request, username, password]);

    const handleCancel = useCallback(() => {
        if (request) {
            onCancel(request);
        }
    }, [onCancel, request]);

    const onUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setUsername(e.target.value);
    }, []);

    const onPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
    }, []);

    const handleTogglePassword = useCallback(() => {
        setShowPassword(!showPassword);
    }, [showPassword]);

    if (!request) {
        return null;
    }

    return (
        <Modal
            id='preAuthModal'
            show={Boolean(request && authInfo)}
            onExited={handleCancel}
            modalHeaderText={authInfo?.isProxy ? (
                <FormattedMessage
                    id='renderer.modals.preAuth.proxyTitle'
                    defaultMessage='Proxy authentication required'
                />
            ) : (
                <FormattedMessage
                    id='renderer.modals.preAuth.serverTitle'
                    defaultMessage='Server authentication required'
                />
            )}
            handleConfirm={handleSubmit}
            handleEnterKeyPress={handleSubmit}
            handleCancel={handleCancel}
            modalSubheaderText={authInfo?.isProxy ? (
                <FormattedMessage
                    id='renderer.modals.preAuth.proxyMessage'
                    defaultMessage='The proxy at {url} requires additional authentication before you can proceed.'
                    values={{url: request.url}}
                />
            ) : (
                <FormattedMessage
                    id='renderer.modals.preAuth.serverMessage'
                    defaultMessage='The server at {url} requires additional authentication before you can proceed.'
                    values={{url: request.url}}
                />
            )}
        >
            <Input
                autoFocus={true}
                id='loginModalUsername'
                name='username'
                type='text'
                inputSize={SIZE.LARGE}
                value={username}
                onChange={onUsernameChange}
                placeholder={intl.formatMessage({id: 'renderer.modals.login.loginModal.username', defaultMessage: 'User Name'})}
            />
            <Input
                id='loginModalPassword'
                name='password'
                type={showPassword ? 'text' : 'password'}
                inputSize={SIZE.LARGE}
                onChange={onPasswordChange}
                value={password}
                placeholder={intl.formatMessage({id: 'renderer.modals.login.loginModal.password', defaultMessage: 'Password'})}
                inputSuffix={
                    <button
                        type='button'
                        className='Input__toggle-password'
                        onClick={handleTogglePassword}
                    >
                        <i className={showPassword ? 'icon icon-eye-off-outline' : 'icon icon-eye-outline'}/>
                    </button>
                }
            />
        </Modal>
    );
}
