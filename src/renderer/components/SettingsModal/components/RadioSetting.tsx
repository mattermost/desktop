// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import './RadioSetting.scss';

export default function RadioSetting({
    id,
    onSave,
    label,
    options,
    ...props
}: {
    id: string;
    onSave: (key: string, value: string) => void;
    label: React.ReactNode;
    value: string;
    options: Array<{value: string; label: React.ReactNode}>;
}) {
    const [value, setValue] = useState(props.value);

    const save = (value: string) => {
        onSave(id, value);
        setValue(value);
    };

    return (
        <div className='RadioSetting'>
            <div className='RadioSetting__heading'>{label}</div>
            <div className='RadioSetting__content'>
                {options.map((option, index) => (
                    <button
                        id={`RadioSetting_${id}_${option.value}`}
                        className='RadioSetting__radio'
                        key={index}
                        onClick={() => save(option.value)}
                    >
                        <input
                            type='radio'
                            value={option.value}
                            name={id}
                            checked={value === option.value}
                            readOnly={true}
                        />
                        <label className='RadioSetting__label'>{option.label}</label>
                    </button>
                ))}
            </div>
        </div>
    );
}
