// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Config} from 'types/config';

import CheckSetting from './CheckSetting';
import RadioSetting from './RadioSetting';

export default function NotificationSetting({
    onSave,
    value,
}: {
    onSave: (key: 'notifications', value: Config['notifications']) => void;
    value: Config['notifications'];
}) {
    if (window.process.platform === 'darwin') {
        return (
            <RadioSetting
                id='notifications.bounceIconType'
                onSave={(k, v) => onSave('notifications', {
                    ...value,
                    bounceIcon: Boolean(v),
                    bounceIconType: v,
                })}
                value={value.bounceIconType}
                label={(
                    <FormattedMessage
                        id='renderer.components.settingsPage.bounceIconType'
                        defaultMessage='Bounce the Dock icon...'
                    />
                )}
                options={[
                    {
                        value: 'informational',
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.bounceIcon.once'
                                defaultMessage='Once'
                            />
                        ),
                    },
                    {
                        value: 'critical',
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.bounceIcon.untilOpenApp'
                                defaultMessage='Until I open the app'
                            />
                        ),
                    },
                    {
                        value: '',
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.bounceIcon.never'
                                defaultMessage='Never'
                            />
                        ),
                    },
                ]}
            />
        );
    }

    return (
        <CheckSetting
            id='flashWindow'
            onSave={(k, v) => onSave('notifications', {...value, [k]: v ? 2 : 0})}
            value={value.flashWindow === 2}
            label={(
                <FormattedMessage
                    id='renderer.components.settingsPage.flashWindow'
                    defaultMessage='Flash taskbar icon when a new message is received'
                />
            )}
            subLabel={(
                <>
                    <FormattedMessage
                        id='renderer.components.settingsPage.flashWindow.description'
                        defaultMessage='If enabled, the taskbar icon will flash for a few seconds when a new message is received.'
                    />
                    {window.process.platform === 'linux' &&
                    <>
                        <br/>
                        <em>
                            <strong>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.flashWindow.description.note'
                                    defaultMessage='NOTE: '
                                />
                            </strong>
                            <FormattedMessage
                                id='renderer.components.settingsPage.flashWindow.description.linuxFunctionality'
                                defaultMessage='This functionality may not work with all Linux window managers.'
                            />
                        </em>
                    </>}
                </>
            )}
        />
    );
}
