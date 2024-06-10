// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import 'renderer/css/components/Toggle.scss';

interface ToggleProps {
    children?: React.ReactNode;
    isChecked: boolean;
    disabled?: boolean;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
}

export default function Toggle({children, isChecked, disabled, onChange}: ToggleProps) {
    return (
        <label
            className={classNames('Toggle', {disabled})}
            tabIndex={0}
        >
            {children}
            <input
                className={classNames('Toggle___input', {disabled})}
                type='checkbox'
                onChange={onChange}
                checked={isChecked}
                disabled={disabled}
            />
            <span className={classNames('Toggle___switch', {disabled, isChecked})}/>
        </label>
    );
}
