// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';

import Input, {SIZE} from 'renderer/components/Input';

import './NumberSetting.scss';

type Props = {
    id: string;
    label: React.ReactNode;
    value: number;
    onSave: (key: string, value: number) => void;
    subLabel?: React.ReactNode;
    min?: number;
    max?: number;
    step?: number;
    bottomBorder?: boolean;
    defaultValue?: number;
};

export default function NumberSetting({
    id,
    onSave,
    label,
    value: propValue,
    subLabel,
    min,
    max,
    step = 1,
    bottomBorder,
    defaultValue,
}: Props) {
    const [value, setValue] = useState<number>(propValue ?? defaultValue);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(event.target.value, 10);
        if (!isNaN(newValue)) {
            if (min !== undefined && newValue < min) {
                setValue(min);
                onSave(id, min);
            } else if (max !== undefined && newValue > max) {
                setValue(max);
                onSave(id, max);
            } else {
                setValue(newValue);
                onSave(id, newValue);
            }
        }
    };

    return (
        <div className={classNames('NumberSetting', {'NumberSetting-bottomBorder': bottomBorder})}>
            <h3 className='NumberSetting__heading'>
                {label}
            </h3>
            {subLabel && <div className='NumberSetting__label'>
                {subLabel}
            </div>}
            <Input
                id={`numberSetting_${id}`}
                type='number'
                value={value}
                onChange={handleChange}
                min={min}
                max={max}
                step={step}
                inputSize={SIZE.MEDIUM}
            />
        </div>
    );
}
