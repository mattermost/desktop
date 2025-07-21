// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import createCache from '@emotion/cache';
import type {EmotionCache} from '@emotion/react';
import {CacheProvider} from '@emotion/react';
import classNames from 'classnames';
import React, {useEffect, useRef, useState, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Modal} from 'renderer/components/Modal';

import type {Config, LocalConfiguration} from 'types/config';
import type {SaveQueueItem, SettingsDefinition} from 'types/settings';

import generateDefinition from './definition';

import './SettingsModal.scss';

enum SavingState {
    SAVING = 1,
    SAVED,
    DONE
}

export default function SettingsModal({
    onClose,
}: {
    onClose: () => void;
}) {
    const intl = useIntl();

    const saveQueue = useRef<SaveQueueItem[]>([]);
    const saveDebounce = useRef<boolean>(false);
    const resetDebounce = useRef<boolean>(false);

    const [savingState, setSavingState] = useState<SavingState>(SavingState.DONE);
    const [selectedCategory, setSelectedCategory] = useState<string>();
    const [config, setConfig] = useState<LocalConfiguration>();
    const [definition, setDefinition] = useState<SettingsDefinition>();
    const [cache, setCache] = useState<EmotionCache>();

    const getConfig = useCallback(() => {
        window.desktop.getLocalConfiguration().then((result) => {
            setConfig(result);
        });
    }, []);

    const getDefinition = useCallback(() => {
        return generateDefinition(intl).then((result) => {
            setDefinition(result);
            return result;
        });
    }, [intl, selectedCategory]);

    const setSavingStateToDone = useCallback(() => {
        resetDebounce.current = false;
        if (savingState !== SavingState.SAVING) {
            setSavingState(SavingState.DONE);
        }
    }, [savingState]);

    const resetSaveState = useCallback(() => {
        if (resetDebounce.current) {
            return;
        }
        resetDebounce.current = true;
        setTimeout(setSavingStateToDone, 2000);
    }, [setSavingStateToDone]);

    const updateConfiguration = useCallback(() => {
        if (saveQueue.current.length === 0) {
            setSavingState(SavingState.SAVED);
            resetSaveState();
        }
        getConfig();
        getDefinition();
    }, [getConfig, resetSaveState]);

    const sendSave = useCallback(() => {
        saveDebounce.current = false;
        window.desktop.updateConfiguration(saveQueue.current.splice(0, saveQueue.current.length));
    }, []);

    const processSaveQueue = useCallback(() => {
        if (saveDebounce.current) {
            return;
        }

        saveDebounce.current = true;
        setTimeout(sendSave, 500);
    }, [sendSave]);

    const save = useCallback((key: keyof Config, data: Config[keyof Config]) => {
        saveQueue.current.push({
            key,
            data,
        });
        setSavingState(SavingState.SAVING);
        processSaveQueue();
    }, [processSaveQueue]);

    useEffect(() => {
        window.desktop.getNonce().then((nonce) => {
            setCache(createCache({
                key: 'react-select-cache',
                nonce,
            }));
        });

        window.desktop.onReloadConfiguration(updateConfiguration);

        getDefinition().then((definition) => {
            setSelectedCategory(Object.keys(definition)[0]);
        });
        getConfig();
    }, []);

    let savingText;
    if (savingState === SavingState.SAVING) {
        savingText = (
            <div className='SettingsModal__saving'>
                <i className='icon-spinner'/>
                <FormattedMessage
                    id='renderer.components.settingsPage.saving'
                    defaultMessage='Saving...'
                />
            </div>
        );
    } else if (savingState === SavingState.SAVED) {
        savingText = (
            <div className='SettingsModal__saving'>
                <i className='icon-check'/>
                <FormattedMessage
                    id='renderer.components.settingsPage.changesSaved'
                    defaultMessage='Changes saved'
                />
            </div>
        );
    }

    if (!cache) {
        return null;
    }

    return (
        <CacheProvider value={cache}>
            <Modal
                id='settingsModal'
                className='SettingsModal'
                show={Boolean(config && definition && selectedCategory)}
                onExited={onClose}
                modalHeaderText={
                    <FormattedMessage
                        id='renderer.components.settingsPage.header'
                        defaultMessage='Desktop App Settings'
                    />
                }
                autoCloseOnConfirmButton={false}
                headerContent={savingText}
                bodyDivider={true}
                bodyPadding={false}
            >
                <div className='SettingsModal__sidebar'>
                    {definition && Object.entries(definition).map(([id, category]) => (
                        <button
                            id={`settingCategoryButton-${id}`}
                            key={id}
                            className={classNames('SettingsModal__category', {selected: id === selectedCategory})}
                            onClick={() => setSelectedCategory(id)}
                        >
                            <i className={`icon icon-${category.icon}`}/>
                            {category.title}
                        </button>
                    ))}
                </div>
                <div className='SettingsModal__content'>
                    {(config && definition && selectedCategory) && definition[selectedCategory].settings.map((setting) => (setting.condition ?? true) && (
                        <setting.component
                            key={setting.id}
                            id={setting.id}
                            onSave={save}
                            value={config[setting.id]}
                            {...setting.props}
                        />
                    ))}
                </div>
            </Modal>
        </CacheProvider>
    );
}
