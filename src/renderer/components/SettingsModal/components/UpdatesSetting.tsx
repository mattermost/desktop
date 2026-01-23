// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import CheckSetting from './CheckSetting';

import './UpdatesSetting.scss';

export default function UpdatesSetting({
    id,
    onSave,
    value,
}: {
    id: string;
    onSave: (key: string, value: boolean) => void;
    value: boolean;
}) {
    return (
        <>
            <CheckSetting
                id={id}
                onSave={onSave}
                value={value}
                label={
                    <FormattedMessage
                        id='renderer.components.settingsPage.updates.automatic'
                        defaultMessage='Automatically check for updates'
                    />
                }
                subLabel={
                    <div className='UpdatesSetting__subLabel'>
                        <FormattedMessage
                            id='renderer.components.settingsPage.updates.automatic.newDescription'
                            defaultMessage='If enabled, you will be automatically notified when a new update is available.'
                        />
                        <button
                            className='UpdatesSetting__button btn btn-primary'
                            id='checkForUpdatesNow'
                            onClick={window.desktop.checkForUpdates}
                        >
                            <FormattedMessage
                                id='renderer.components.settingsPage.updates.checkNow'
                                defaultMessage='Check for Updates Now'
                            />
                        </button>
                    </div>
                }
            />
        </>
    );
}
