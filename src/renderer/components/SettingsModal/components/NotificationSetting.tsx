// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {SingleValue} from 'react-select';
import CreatableSelect from 'react-select/creatable';

import type {CurrentConfig, LocalConfiguration} from 'types/config';

import CheckSetting from './CheckSetting';
import RadioSetting from './RadioSetting';

import './NotificationSetting.scss';

type ChannelOption = {
    value: string;
    label: string;
};

/**
 * Settings component for notifications, supporting dock bounce / taskbar flash,
 * default direct message sound selection, and per-channel or per-user sound overrides.
 *
 * @param props - Component props containing the save callback, current notification settings, and full config.
 * @returns The rendered notification settings section.
 */
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
    const [channelOptions, setChannelOptions] = useState<ChannelOption[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<ChannelOption | null>(null);
    const [isLoadingChannels, setIsLoadingChannels] = useState(false);
    const [newChannelSound, setNewChannelSound] = useState('Ding');

    useEffect(() => {
        let isMounted = true;
        setIsLoadingChannels(true);
        window.desktop.getAvailableChannels().then((channels) => {
            if (!isMounted) {
                return;
            }
            const options: ChannelOption[] = channels.map((ch) => ({
                value: ch.id,
                label: ch.label,
            }));
            setChannelOptions(options);
            setIsLoadingChannels(false);
        }).catch(() => {
            if (isMounted) {
                setIsLoadingChannels(false);
            }
        });

        return () => {
            isMounted = false;
        };
    }, []);

    const handleAddOverride = () => {
        if (!selectedChannel || !selectedChannel.value.trim()) {
            return;
        }
        const channelKey = selectedChannel.value.trim();
        const channelLabel = selectedChannel.label.trim();

        const updatedSounds = {
            ...config?.channelNotificationSounds,
            [channelKey]: newChannelSound,
        };
        onSave('channelNotificationSounds', updatedSounds);

        const updatedNames = {
            ...config?.channelNotificationSoundNames,
            [channelKey]: channelLabel,
        };
        onSave('channelNotificationSoundNames', updatedNames);

        setSelectedChannel(null);
        setNewChannelSound('Ding');
    };

    const handleRemoveOverride = (channelKey: string) => {
        const updatedSounds = {...config?.channelNotificationSounds};
        delete updatedSounds[channelKey];
        onSave('channelNotificationSounds', updatedSounds);

        const updatedNames = {...config?.channelNotificationSoundNames};
        if (updatedNames[channelKey]) {
            delete updatedNames[channelKey];
            onSave('channelNotificationSoundNames', updatedNames);
        }
    };

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
                                {Object.entries(config?.channelNotificationSounds || {}).map(([channelKey, sound]) => {
                                    const displayName = config?.channelNotificationSoundNames?.[channelKey] || channelKey;
                                    return (
                                        <div
                                            key={channelKey}
                                            className='NotificationSetting__overrideItem'
                                        >
                                            <span className='NotificationSetting__overrideChannel'>{displayName}</span>
                                            <span className='NotificationSetting__overrideSound'>
                                                {sound === 'None' ? (
                                                    <FormattedMessage
                                                        id='renderer.components.settingsPage.sound.none'
                                                        defaultMessage='None (Silent)'
                                                    />
                                                ) : sound}
                                            </span>
                                            <button
                                                type='button'
                                                className='btn btn-tertiary btn-danger btn-sm'
                                                onClick={() => handleRemoveOverride(channelKey)}
                                            >
                                                <FormattedMessage
                                                    id='renderer.components.settingsPage.remove'
                                                    defaultMessage='Remove'
                                                />
                                            </button>
                                        </div>
                                    );
                                })}
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
                            <CreatableSelect
                                inputId='notificationSetting_channel'
                                className='NotificationSetting__channelSelect'
                                classNamePrefix='NotificationSetting__channelSelect'
                                isClearable={true}
                                isLoading={isLoadingChannels}
                                options={channelOptions}
                                value={selectedChannel}
                                onChange={(val) => setSelectedChannel(val as SingleValue<ChannelOption>)}
                                menuPosition='fixed'
                                placeholder={intl.formatMessage({
                                    id: 'renderer.components.settingsPage.selectChannelPlaceholder',
                                    defaultMessage: 'Select or search a channel...',
                                })}
                            />
                            <select
                                className='NotificationSetting__select'
                                value={newChannelSound}
                                onChange={(e) => setNewChannelSound(e.target.value)}
                            >
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
                            <button
                                type='button'
                                className='btn btn-primary btn-sm'
                                disabled={!selectedChannel || !selectedChannel.value.trim()}
                                onClick={handleAddOverride}
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
