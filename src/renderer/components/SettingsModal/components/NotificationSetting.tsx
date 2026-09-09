// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {CurrentConfig, LocalConfiguration} from 'types/config';

import CheckSetting from './CheckSetting';
import RadioSetting from './RadioSetting';

import './NotificationSetting.scss';

export default function NotificationSetting({
    onSave,
    value,
    config,
}: {
    onSave: (key: keyof CurrentConfig, value: CurrentConfig[keyof CurrentConfig]) => void;
    value: CurrentConfig['notifications'];
    config?: LocalConfiguration;
}) {
    const intl = useIntl();
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelSound, setNewChannelSound] = useState('Ding');

    const renderSoundCustomizer = () => {
        return (
            <>
                <div className='NotificationSetting__divider'/>
                <div className='NotificationSetting__section'>
                    <h3 className='NotificationSetting__sectionTitle'>
                        <FormattedMessage
                            id='renderer.components.settingsPage.customNotificationSounds'
                            defaultMessage='Custom Notification Sounds'
                        />
                    </h3>
                    <div className='NotificationSetting__row'>
                        <label className='NotificationSetting__label'>
                            <FormattedMessage
                                id='renderer.components.settingsPage.dmNotificationSound'
                                defaultMessage='Default Direct Message Sound'
                            />
                        </label>
                        <select
                            className='NotificationSetting__select'
                            value={config?.dmNotificationSound || ''}
                            onChange={(e) => onSave('dmNotificationSound', e.target.value)}
                        >
                            <option value=''>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.sound.default'
                                    defaultMessage='Default'
                                />
                            </option>
                            <option value='None'>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.sound.none'
                                    defaultMessage='None (Silent)'
                                />
                            </option>
                            <option value='Ding'>{'Ding'}</option>
                            <option value='Bing'>{'Bing'}</option>
                            <option value='Crackle'>{'Crackle'}</option>
                            <option value='Down'>{'Down'}</option>
                            <option value='Hello'>{'Hello'}</option>
                            <option value='Ripple'>{'Ripple'}</option>
                            <option value='Upstairs'>{'Upstairs'}</option>
                        </select>
                    </div>

                    <div className='NotificationSetting__subSection'>
                        <h4 className='NotificationSetting__subTitle'>
                            <FormattedMessage
                                id='renderer.components.settingsPage.channelOverrides'
                                defaultMessage='Channel/User Specific Sounds'
                            />
                        </h4>
                        {Object.keys(config?.channelNotificationSounds || {}).length > 0 ? (
                            <div className='NotificationSetting__overridesList'>
                                {Object.entries(config?.channelNotificationSounds || {}).map(([channel, sound]) => (
                                    <div
                                        key={channel}
                                        className='NotificationSetting__overrideItem'
                                    >
                                        <span className='NotificationSetting__overrideChannel'>{channel}</span>
                                        <span className='NotificationSetting__overrideSound'>{sound}</span>
                                        <button
                                            type='button'
                                            className='btn btn-tertiary btn-danger btn-sm'
                                            onClick={() => {
                                                const updated = {...config?.channelNotificationSounds};
                                                delete updated[channel];
                                                onSave('channelNotificationSounds', updated);
                                            }}
                                        >
                                            <FormattedMessage
                                                id='renderer.components.settingsPage.remove'
                                                defaultMessage='Remove'
                                            />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className='NotificationSetting__noOverrides'>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.noOverrides'
                                    defaultMessage='No custom channel sounds configured.'
                                />
                            </div>
                        )}

                        <div className='NotificationSetting__addOverrideForm'>
                            <input
                                type='text'
                                className='NotificationSetting__input'
                                placeholder={intl.formatMessage({
                                    id: 'renderer.components.settingsPage.channelNameOrId',
                                    defaultMessage: 'Channel Name, ID, or @username',
                                })}
                                value={newChannelName}
                                onChange={(e) => setNewChannelName(e.target.value)}
                            />
                            <select
                                className='NotificationSetting__select'
                                value={newChannelSound}
                                onChange={(e) => setNewChannelSound(e.target.value)}
                            >
                                <option value='None'>{'None (Silent)'}</option>
                                <option value='Ding'>{'Ding'}</option>
                                <option value='Bing'>{'Bing'}</option>
                                <option value='Crackle'>{'Crackle'}</option>
                                <option value='Down'>{'Down'}</option>
                                <option value='Hello'>{'Hello'}</option>
                                <option value='Ripple'>{'Ripple'}</option>
                                <option value='Upstairs'>{'Upstairs'}</option>
                            </select>
                            <button
                                type='button'
                                className='btn btn-primary btn-sm'
                                disabled={!newChannelName.trim()}
                                onClick={() => {
                                    const trimmed = newChannelName.trim();
                                    if (trimmed) {
                                        const updated = {
                                            ...config?.channelNotificationSounds,
                                            [trimmed]: newChannelSound,
                                        };
                                        onSave('channelNotificationSounds', updated);
                                        setNewChannelName('');
                                        setNewChannelSound('Ding');
                                    }
                                }}
                            >
                                <FormattedMessage
                                    id='renderer.components.settingsPage.add'
                                    defaultMessage='Add'
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    if (window.process.platform === 'darwin') {
        return (
            <>
                <RadioSetting
                    id='notifications.bounceIconType'
                    onSave={(k, v) => onSave('notifications', {
                        ...value,
                        bounceIcon: Boolean(v),
                        bounceIconType: v as '' | 'critical' | 'informational',
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
                {renderSoundCustomizer()}
            </>
        );
    }

    return (
        <>
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
            {renderSoundCustomizer()}
        </>
    );
}
