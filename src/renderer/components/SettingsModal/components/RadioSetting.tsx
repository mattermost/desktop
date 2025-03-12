// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import './RadioSetting.scss';

export default function RadioSetting<T extends string>({
    id,
    onSave,
    label,
    options,
    ...props
}: {
    id: string;
    onSave: (key: string, value: T) => void;
    label: React.ReactNode;
    value: T;
    options: Array<{value: T; label: React.ReactNode}>;
}) {
    const [value, setValue] = useState(props.value);

    const save = (value: T) => {
        onSave(id, value);
        setValue(value);
    };

    return (
        <div className='RadioSetting'>
            <div className='RadioSetting__heading'>{label}</div>
            <div
                className='RadioSetting__content'
                role='radiogroup'
            >
                {options.map((option, index) => (
                    <button
                        id={`RadioSetting_${id}_${option.value}`}
                        className='RadioSetting__radio'
                        key={`${index}`}
                        onClick={() => save(option.value)}
                        role='radio'
                        aria-checked={value === option.value}
                    >
                        <input
                            type='radio'
                            value={option.value}
                            name={id}
                            checked={value === option.value}
                            readOnly={true}
                        />
                        <label
                            htmlFor={`RadioSetting_${id}_${option.value}`}
                            className='RadioSetting__label'
                        >
                            {option.label}
                        </label>
                    </button>
                ))}
            </div>
        </div>
    );
}
