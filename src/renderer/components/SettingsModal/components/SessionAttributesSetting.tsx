// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import CheckSetting from './CheckSetting';

import './SessionAttributesSetting.scss';

export default function SessionAttributesSetting({
    id,
    onSave,
    label,
    subLabel,
    ...props
}: {
    id: string;
    onSave: (key: string, value: boolean) => void;
    value: boolean;
    label: React.ReactNode;
    subLabel?: React.ReactNode;
}) {
    const [enabled, setEnabled] = useState(props.value);
    const [attributes, setAttributes] = useState<Record<string, string>>();

    useEffect(() => {
        if (!enabled) {
            return;
        }

        window.desktop.getSessionAttributes().then(setAttributes);
    }, [enabled]);

    const save = useCallback((key: string, value: boolean) => {
        setEnabled(value);
        onSave(key, value);
    }, [onSave]);

    return (
        <div className='SessionAttributesSetting'>
            <CheckSetting
                id={id}
                onSave={save}
                value={props.value}
                label={label}
                subLabel={subLabel}
            />
            {enabled && attributes && (
                <table className='SessionAttributesSetting__table'>
                    <thead>
                        <tr>
                            <th>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.enableSessionAttributes.attribute'
                                    defaultMessage='Attribute'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.enableSessionAttributes.currentValue'
                                    defaultMessage='Current Value'
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(attributes).map(([name, value]) => (
                            <tr key={name}>
                                <td>{name}</td>
                                <td className={value ? undefined : 'SessionAttributesSetting__unavailable'}>
                                    {value || (
                                        <FormattedMessage
                                            id='renderer.components.settingsPage.enableSessionAttributes.notAvailable'
                                            defaultMessage='Not available'
                                        />
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
