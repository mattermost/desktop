// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import './DownloadSetting.scss';
import Input, {SIZE} from 'renderer/components/Input';

export default function DownloadSetting({
    id,
    onSave,
    ...props
}: {
    id: string;
    onSave: (key: string, value: string) => void;
    label: React.ReactNode;
    value: string;
}) {
    const [value, setValue] = useState(props.value);

    const selectDownloadLocation = async () => {
        const newDownloadLocation = await window.desktop.getDownloadLocation(props.value);
        if (!newDownloadLocation) {
            return;
        }

        onSave(id, newDownloadLocation);
        setValue(newDownloadLocation);
    };

    return (
        <div className='DownloadSetting'>
            <h3 className='DownloadSetting__heading'>
                <FormattedMessage
                    id='renderer.components.settingsPage.downloadLocation'
                    defaultMessage='Download Location'
                />
            </h3>
            <div className='DownloadSetting__label'>
                <FormattedMessage
                    id='renderer.components.settingsPage.downloadLocation.description'
                    defaultMessage='Specify the folder where files will download.'
                />
            </div>
            <div className='DownloadSetting__content'>
                <Input
                    disabled={true}
                    value={value}
                    inputSize={SIZE.MEDIUM}
                />
                <button
                    className='DownloadSetting__changeButton btn btn-tertiary'
                    id='saveDownloadLocation'
                    onClick={selectDownloadLocation}
                >
                    <FormattedMessage
                        id='label.change'
                        defaultMessage='Change'
                    />
                </button>
            </div>
        </div>
    );
}
