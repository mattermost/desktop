// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Modal} from 'renderer/components/Modal';

import type {MessageModalInfo, MessageModalResult} from 'types/modals';

import './messageModal.scss';

type Props = {
    onFinish: (result: MessageModalResult) => void;
    getInfo: () => Promise<MessageModalInfo>;
};

export default function MessageModal({onFinish, getInfo}: Props) {
    const [info, setInfo] = useState<MessageModalInfo>();
    const [checkboxChecked, setCheckboxChecked] = useState(false);

    useEffect(() => {
        getInfo().then((data) => {
            setInfo(data);
            setCheckboxChecked(Boolean(data.checkboxChecked));
        });
    }, [getInfo]);

    const finish = useCallback((response: number) => {
        onFinish({response, checkboxChecked});
    }, [onFinish, checkboxChecked]);

    if (!info) {
        return null;
    }

    const buttons = info.buttons?.length ? info.buttons : undefined;
    const cancelId = info.cancelId ?? (buttons ? buttons.length - 1 : 0);
    const defaultId = info.defaultId ?? cancelId;

    const footerContent = (
        <>
            {buttons ? buttons.map((label, index) => (
                <button
                    key={label}
                    type='button'
                    autoFocus={index === defaultId}
                    className={classNames('Modal__button btn', {
                        'btn-primary': index === defaultId,
                        'btn-tertiary': index !== defaultId,
                    })}
                    onClick={() => finish(index)}
                >
                    {label}
                </button>
            )) : (
                <button
                    type='button'
                    autoFocus={true}
                    className='Modal__button btn btn-primary'
                    onClick={() => finish(0)}
                >
                    <FormattedMessage
                        id='label.ok'
                        defaultMessage='OK'
                    />
                </button>
            )}
        </>
    );

    return (
        <Modal
            id='messageModal'
            className={classNames('MessageModal', {[`MessageModal--${info.type}`]: info.type})}
            modalHeaderText={info.title}
            onExited={() => finish(cancelId)}
            footerContent={footerContent}
        >
            <p className='MessageModal__message'>{info.message}</p>
            {info.detail && <p className='MessageModal__detail'>{info.detail}</p>}
            {info.checkboxLabel && (
                <label className='MessageModal__checkbox'>
                    <input
                        type='checkbox'
                        checked={checkboxChecked}
                        onChange={(e) => setCheckboxChecked(e.target.checked)}
                    />
                    {info.checkboxLabel}
                </label>
            )}
        </Modal>
    );
}
