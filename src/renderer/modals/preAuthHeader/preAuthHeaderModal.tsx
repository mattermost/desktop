// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React, {useState, useEffect, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import Input, {SIZE, STATUS} from 'renderer/components/Input';
import {Modal} from 'renderer/components/Modal';

type Props = {
    onCancel: () => void;
    onSubmit: (secret: string) => void;
    getPreAuthInfo: () => Promise<{url: string}>;
};

export default function PreAuthHeaderModal({onCancel, onSubmit, getPreAuthInfo}: Props) {
    const intl = useIntl();

    const [secret, setSecret] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [requestUrl, setRequestUrl] = useState('');

    const getPreAuthInfoData = useCallback(async () => {
        const {url} = await getPreAuthInfo();
        setRequestUrl(url);
    }, [getPreAuthInfo]);

    useEffect(() => {
        getPreAuthInfoData();
    }, []);

    const handleSubmit = useCallback(() => {
        onSubmit(secret);
    }, [onSubmit, secret]);

    const handleCancel = useCallback(() => {
        onCancel();
    }, [onCancel]);

    const onChangeSecret = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSecret(e.target.value);
    }, []);

    const handleToggleSecret = useCallback(() => {
        setShowSecret(!showSecret);
    }, [showSecret]);

    return (
        <Modal
            id='preAuthModal'
            show={Boolean(requestUrl)}
            onExited={handleCancel}
            modalHeaderText={
                <FormattedMessage
                    id='renderer.modals.preAuth.title'
                    defaultMessage='Server authentication required'
                />
            }
            handleConfirm={handleSubmit}
            handleEnterKeyPress={handleSubmit}
            handleCancel={handleCancel}
            modalSubheaderText={
                <FormattedMessage
                    id='renderer.modals.preAuth.message'
                    defaultMessage='The server at {url} requires additional authentication before you can proceed.'
                    values={{url: requestUrl}}
                />
            }
        >
            <Input
                id='preAuthHeaderModalSecret'
                name='secret'
                type={showSecret ? 'text' : 'password'}
                inputSize={SIZE.LARGE}
                onChange={onChangeSecret}
                customMessage={({
                    type: STATUS.INFO,
                    value: intl.formatMessage({
                        id: 'renderer.components.newServerModal.secureSecret.info',
                        defaultMessage: 'The authentication secret shared by the administrator.',
                    }),
                })}
                value={secret}
                placeholder={intl.formatMessage({id: 'renderer.modals.preAuth.secret', defaultMessage: 'Authentication Secret'})}
                inputSuffix={
                    <button
                        type='button'
                        className='Input__toggle-password'
                        onClick={handleToggleSecret}
                    >
                        <i className={showSecret ? 'icon icon-eye-off-outline' : 'icon icon-eye-outline'}/>
                    </button>
                }
            />
        </Modal>
    );
}
