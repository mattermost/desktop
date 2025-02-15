// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import ReactSelect from 'react-select';
import type {ActionMeta, MultiValue, PropsValue, SingleValue} from 'react-select';

import './SelectSetting.scss';

type Option = {value: string; label: string};

type IsMulti = {
    isMulti: true;
    value: string[];
    onSave: (key: string, value: string[]) => void;
} | {
    isMulti: false;
    value: string;
    onSave: (key: string, value: string) => void;
}
type Props = IsMulti & {
    id: string;
    label: React.ReactNode;
    options: Option[];
    subLabel?: React.ReactNode;
    placeholder?: React.ReactNode;
    bottomBorder?: boolean;
};

function valueToOption(value: string | string[], options: Option[]): PropsValue<Option> {
    if (Array.isArray(value)) {
        return value.map((v) => options.find((o) => o.value === v)!);
    }

    return options.find((o) => o.value === value)!;
}

export default function SelectSetting({
    id,
    onSave,
    label,
    options,
    isMulti,
    subLabel,
    bottomBorder,
    value: propValue,
    placeholder,
}: Props) {
    const [value, setValue] = useState<PropsValue<Option>>(valueToOption(propValue, options));

    const save = (newValue: PropsValue<Option>, actionMeta: ActionMeta<Option>) => {
        if (isMulti) {
            let values = [...(value as MultiValue<Option>).map((v) => v.value)];
            switch (actionMeta.action) {
            case 'select-option':
                values = [...(newValue as MultiValue<Option>).map((v) => v.value)];
                break;
            case 'remove-value':
                values = values.filter((v) => v !== actionMeta.removedValue.value);
                break;
            case 'clear':
                values = [];
                break;
            }

            onSave(id, values);
        } else {
            const singleValue = newValue as SingleValue<Option>;
            if (!singleValue) {
                return;
            }
            onSave(id, singleValue.value);
        }

        setValue(newValue);
    };

    return (
        <div className={classNames('SelectSetting', {'SelectSetting-bottomBorder': bottomBorder})}>
            <h3 className='SelectSetting__heading'>
                {label}
            </h3>
            {subLabel && <div className='SelectSetting__label'>
                {subLabel}
            </div>}
            <ReactSelect
                inputId={`selectSetting_${id}`}
                className='SelectSetting__select'
                classNamePrefix='SelectSetting__select'
                options={options}
                onChange={save}
                isMulti={isMulti}
                value={value}
                menuPosition='fixed'
                placeholder={placeholder}
            />
        </div>
    );
}
