// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import Input, {SIZE} from 'renderer/components/Input';

import CheckSetting from './CheckSetting';
import SelectSetting from './SelectSetting';

import './SpellCheckerSetting.scss';

type Option = {value: string; label: string};

export default function SpellCheckerSetting({
    id,
    onSave,
    label,
    options,
    subLabel,
    heading,
    value: propValue,
}: {
    id: string;
    onSave: (key: string, value: string | boolean | string[]) => void;
    label: React.ReactNode;
    options: Option[];
    subLabel?: React.ReactNode;
    heading?: React.ReactNode;
    value: boolean;
}) {
    const [spellCheckerLocales, setSpellCheckerLocales] = useState<string[]>();

    const [spellCheckerURL, setSpellCheckerURL] = useState<string>();
    const [editingURL, setEditingURL] = useState(false);

    useEffect(() => {
        // Unfortunately we need to sidestep the props for this one as it is a very special case
        window.desktop.getLocalConfiguration().then((config) => {
            setSpellCheckerLocales(config.spellCheckerLocales);
            setSpellCheckerURL(config.spellCheckerURL);
        });
    }, []);

    const saveSpellCheckerLocales = (key: string, newValue: string[]) => {
        onSave('spellCheckerLocales', newValue);
        setSpellCheckerLocales(newValue);
    };

    const editURL = () => {
        if (editingURL) {
            onSave('spellCheckerURL', spellCheckerURL ?? '');
        }
        setEditingURL(!editingURL);
    };

    if (!spellCheckerLocales) {
        return null;
    }

    return (
        <div className='SpellCheckerSetting'>
            <CheckSetting
                id={id}
                onSave={onSave}
                label={label}
                subLabel={subLabel}
                value={propValue}
                heading={heading}
            />
            {propValue &&
                <SelectSetting
                    id='spellCheckerLocales'
                    onSave={saveSpellCheckerLocales}
                    label={(
                        <FormattedMessage
                            id='renderer.components.settingsPage.spellCheckerSetting.language'
                            defaultMessage='Spell Checker Languages'
                        />
                    )}
                    options={options}
                    value={spellCheckerLocales}
                    isMulti={true}
                    placeholder={
                        <FormattedMessage
                            id='renderer.components.settingsPage.checkSpelling.preferredLanguages'
                            defaultMessage='Select preferred language(s)'
                        />
                    }
                />
            }
            {propValue &&
                <div className='SpellCheckerSetting__alternative'>
                    <h4 className='SpellCheckerSetting__alternative__heading'>
                        <FormattedMessage
                            id='renderer.components.settingsPage.checkSpelling.editSpellcheckUrl'
                            defaultMessage='Use an alternative dictionary URL'
                        />
                    </h4>
                    <div className='SpellCheckerSetting__alternative__label'>
                        <FormattedMessage
                            id='renderer.components.settingsPage.checkSpelling.specifyURL'
                            defaultMessage='Specify the url where dictionary definitions can be retrieved'
                        />
                    </div>
                    <div className='SpellCheckerSetting__alternative__content'>
                        <Input
                            disabled={!editingURL}
                            value={spellCheckerURL}
                            inputSize={SIZE.MEDIUM}
                            onChange={(e) => setSpellCheckerURL(e.target.value)}
                        />
                        <button
                            className={classNames('DownloadSetting__changeButton btn', {
                                'btn-primary': editingURL,
                                'btn-tertiary': !editingURL,
                            })}
                            id='saveDownloadLocation'
                            onClick={editURL}
                        >
                            {editingURL &&
                                <FormattedMessage
                                    id='label.save'
                                    defaultMessage='Save'
                                />
                            }
                            {!editingURL &&
                                <FormattedMessage
                                    id='label.change'
                                    defaultMessage='Change'
                                />
                            }
                        </button>
                    </div>
                </div>
            }
        </div>
    );
}
