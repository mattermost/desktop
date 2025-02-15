// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';

import './CheckSetting.scss';

export default function CheckSetting({
    id,
    onSave,
    label,
    heading,
    subLabel,
    ...props
}: {
    id: string;
    onSave: (key: string, value: boolean) => void;
    label: React.ReactNode;
    value: boolean;
    heading?: React.ReactNode;
    subLabel?: React.ReactNode;
}) {
    const [value, setValue] = useState(props.value);
    const save = () => {
        onSave(id, !value);
        setValue(!value);
    };

    return (
        <div className='CheckSetting'>
            {heading && <div className='CheckSetting__heading'>{heading}</div>}
            <div className='CheckSetting__content'>
                <button
                    className={classNames('CheckSetting__checkbox', {checked: value})}
                    onClick={save}
                >
                    <i className='icon-check'/>
                </button>
                <div className='CheckSetting__label'>
                    {label}
                    {subLabel && <div className='CheckSetting__sublabel'>{subLabel}</div>}
                </div>
            </div>
        </div>
    );
}
