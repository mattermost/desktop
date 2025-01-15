// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import LoadingWrapper from './LoadingWrapper';

import 'renderer/css/components/Button.scss';

type Props = {
    saving: boolean;
    disabled?: boolean;
    id?: string;
    onClick: (e: React.MouseEvent) => void;
    savingMessage?: React.ReactNode;
    defaultMessage?: React.ReactNode;
    extraClasses?: string;
}

const SaveButton = ({
    id,
    defaultMessage = (
        <FormattedMessage
            id='renderer.components.saveButton.save'
            defaultMessage='Save'
        />
    ),
    disabled,
    extraClasses,
    saving,
    savingMessage = (
        <FormattedMessage
            id='renderer.components.saveButton.saving'
            defaultMessage='Saving'
        />
    ),
    onClick,
}: Props) => {
    const handleOnClick = (e: React.MouseEvent) => {
        if (saving) {
            return;
        }

        onClick(e);
    };

    return (
        <button
            id={id}
            className={classNames(
                'primary-button primary-large-button',
                extraClasses && extraClasses,
            )}
            disabled={disabled}
            onClick={handleOnClick}
        >
            <LoadingWrapper
                loading={saving}
                text={savingMessage}
            >
                <span>{defaultMessage}</span>
            </LoadingWrapper>
        </button>
    );
};

export default SaveButton;
